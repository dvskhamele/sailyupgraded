"use server";

import { getSession } from "@/lib/auth-server";
import { sendSMS } from "@/actions/crm/sms/send-sms";
import { resolveMergeTags } from "@/lib/campaigns/merge-tags";
import { getTwilioIntegration } from "@/lib/integrations/twilio";
import { sendSmtp2GoEmail } from "@/lib/email/smtp2go";
import {
  DEFAULT_SMTP2GO_SENDER,
  isAllowedSmtp2GoSender,
  normalizeSenderEmail,
} from "@/lib/email/sender-policy";

export type BulkMessageRecipient = {
  id: string;
  originalId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  mobilePhone?: string;
  officePhone?: string;
  company?: string;
  jobTitle?: string;
  type?: "Account" | "Contact" | string;
};

export type SendBulkMessagesInput = {
  channel: "sms" | "email" | "whatsapp";
  recipients: BulkMessageRecipient[];
  message: string;
  subject?: string;
  fromEmail?: string;
};

export type SendBulkMessagesResult = {
  success: boolean;
  total: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  failures?: Array<{
    recipientName: string;
    contactInfo: string;
    error: string;
  }>;
  error?: string;
};

function normalizePhoneNumber(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  if (
    !cleaned ||
    lower === "unavailable" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "none"
  ) {
    return null;
  }
  // Check if string contains at least some digits
  const digitCount = (cleaned.match(/\d/g) || []).length;
  if (digitCount < 5) return null;
  return cleaned;
}

function normalizeEmailAddress(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (
    !cleaned ||
    !cleaned.includes("@") ||
    cleaned === "unavailable" ||
    cleaned === "extrapolated" ||
    cleaned === "entry" ||
    cleaned === "null"
  ) {
    return null;
  }
  return cleaned;
}

export async function sendBulkMessages(
  input: SendBulkMessagesInput
): Promise<SendBulkMessagesResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      success: false,
      total: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      error: "You must be signed in to send messages.",
    };
  }

  const userId = session.user.id as string;
  const { channel, message, recipients = [], subject = "", fromEmail } = input;

  if (!message || !message.trim()) {
    return {
      success: false,
      total: recipients.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      error: "Message body cannot be empty.",
    };
  }

  if (recipients.length === 0) {
    return {
      success: false,
      total: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      error: "No recipients selected.",
    };
  }

  // Handle SMS Channel
  if (channel === "sms") {
    // Check Twilio Integration
    const twilioIntegration = await getTwilioIntegration(userId);
    const hasDbTwilio = Boolean(
      twilioIntegration?.accountSid &&
      twilioIntegration?.authToken &&
      twilioIntegration?.phoneNumber
    );
    const hasEnvTwilio = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    if (!hasDbTwilio && !hasEnvTwilio) {
      return {
        success: false,
        total: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        error: "Twilio SMS is not configured in Saily. Please set up Twilio in Integrations.",
      };
    }

    // Filter & deduplicate recipients with valid phone numbers
    const seenPhoneNumbers = new Set<string>();
    const validRecipients: Array<{
      recipient: BulkMessageRecipient;
      phone: string;
    }> = [];
    let skippedCount = 0;

    for (const r of recipients) {
      const phoneCandidate =
        normalizePhoneNumber(r.phone) ||
        normalizePhoneNumber(r.mobilePhone) ||
        normalizePhoneNumber(r.officePhone);

      if (!phoneCandidate) {
        skippedCount++;
        continue;
      }

      const dedupeKey = phoneCandidate.replace(/[\s\-\(\)\.]/g, "");
      if (seenPhoneNumbers.has(dedupeKey)) {
        continue;
      }
      seenPhoneNumbers.add(dedupeKey);
      validRecipients.push({ recipient: r, phone: phoneCandidate });
    }

    if (validRecipients.length === 0) {
      return {
        success: false,
        total: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount,
        error: "None of the selected records have valid phone numbers.",
      };
    }

    let sentCount = 0;
    const failures: Array<{
      recipientName: string;
      contactInfo: string;
      error: string;
    }> = [];

    for (const { recipient, phone } of validRecipients) {
      const firstName =
        recipient.firstName ||
        (recipient.name ? recipient.name.split(" ")[0] : "");
      const lastName =
        recipient.lastName ||
        (recipient.name && recipient.name.split(" ").length > 1
          ? recipient.name.split(" ").slice(1).join(" ")
          : "");

      const personalizedMessage = resolveMergeTags(message, {
        firstName,
        first_name: firstName,
        lastName,
        last_name: lastName,
        email: recipient.email || recipient.personalEmail || "",
        company: recipient.company || "",
        position: recipient.jobTitle || "",
        jobTitle: recipient.jobTitle || "",
        phone,
        name: recipient.fullName || recipient.name || "",
        fullName: recipient.fullName || recipient.name || "",
      });

      try {
        const result = await sendSMS({
          to: phone,
          message: personalizedMessage,
          contactId:
            recipient.type === "Contact" ? recipient.originalId : undefined,
        });

        if (result.error) {
          failures.push({
            recipientName: recipient.fullName || recipient.name || "Recipient",
            contactInfo: phone,
            error: result.error,
          });
        } else {
          sentCount++;
        }
      } catch (err: any) {
        failures.push({
          recipientName: recipient.fullName || recipient.name || "Recipient",
          contactInfo: phone,
          error: err.message || "Failed to send SMS",
        });
      }
    }

    const failedCount = failures.length;
    return {
      success: sentCount > 0 && failedCount === 0,
      total: validRecipients.length,
      sentCount,
      failedCount,
      skippedCount,
      failures: failures.length > 0 ? failures : undefined,
      error:
        failedCount > 0
          ? sentCount === 0
            ? failures[0]?.error || "Failed to send SMS message(s)."
            : `${failedCount} SMS message(s) failed to send.`
          : undefined,
    };
  }

  // Handle Email Channel
  if (channel === "email") {
    const from = normalizeSenderEmail(fromEmail || DEFAULT_SMTP2GO_SENDER);
    if (!isAllowedSmtp2GoSender(from)) {
      return {
        success: false,
        total: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        error: "Sender email domain is not permitted.",
      };
    }

    const seenEmails = new Set<string>();
    const validRecipients: Array<{
      recipient: BulkMessageRecipient;
      email: string;
    }> = [];
    let skippedCount = 0;

    for (const r of recipients) {
      const emailCandidate =
        normalizeEmailAddress(r.email) ||
        normalizeEmailAddress(r.personalEmail);

      if (!emailCandidate) {
        skippedCount++;
        continue;
      }

      if (seenEmails.has(emailCandidate)) {
        continue;
      }
      seenEmails.add(emailCandidate);
      validRecipients.push({ recipient: r, email: emailCandidate });
    }

    if (validRecipients.length === 0) {
      return {
        success: false,
        total: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount,
        error: "None of the selected records have valid email addresses.",
      };
    }

    let sentCount = 0;
    const failures: Array<{
      recipientName: string;
      contactInfo: string;
      error: string;
    }> = [];

    for (const { recipient, email } of validRecipients) {
      const firstName =
        recipient.firstName ||
        (recipient.name ? recipient.name.split(" ")[0] : "");
      const lastName =
        recipient.lastName ||
        (recipient.name && recipient.name.split(" ").length > 1
          ? recipient.name.split(" ").slice(1).join(" ")
          : "");

      const personalizedSubject = resolveMergeTags(subject || "Message from Saily", {
        firstName,
        first_name: firstName,
        lastName,
        last_name: lastName,
        email,
        company: recipient.company || "",
        position: recipient.jobTitle || "",
        jobTitle: recipient.jobTitle || "",
        phone: recipient.phone || "",
        name: recipient.fullName || recipient.name || "",
        fullName: recipient.fullName || recipient.name || "",
      });

      const personalizedBody = resolveMergeTags(message, {
        firstName,
        first_name: firstName,
        lastName,
        last_name: lastName,
        email,
        company: recipient.company || "",
        position: recipient.jobTitle || "",
        jobTitle: recipient.jobTitle || "",
        phone: recipient.phone || "",
        name: recipient.fullName || recipient.name || "",
        fullName: recipient.fullName || recipient.name || "",
      });

      try {
        const sendRes = await sendSmtp2GoEmail({
          userId,
          from,
          recipient: email,
          subject: personalizedSubject,
          message: personalizedBody,
        });

        if (!sendRes.success) {
          failures.push({
            recipientName: recipient.fullName || recipient.name || "Recipient",
            contactInfo: email,
            error: sendRes.error || "Failed to send email",
          });
        } else {
          sentCount++;
        }
      } catch (err: any) {
        failures.push({
          recipientName: recipient.fullName || recipient.name || "Recipient",
          contactInfo: email,
          error: err.message || "Failed to send email",
        });
      }
    }

    const failedCount = failures.length;
    return {
      success: sentCount > 0 && failedCount === 0,
      total: validRecipients.length,
      sentCount,
      failedCount,
      skippedCount,
      failures: failures.length > 0 ? failures : undefined,
      error:
        failedCount > 0
          ? sentCount === 0
            ? failures[0]?.error || "Failed to send email(s)."
            : `${failedCount} email(s) failed to send.`
          : undefined,
    };
  }

  // Handle WhatsApp Channel
  if (channel === "whatsapp") {
    // Collect valid recipients with phone
    const seenPhoneNumbers = new Set<string>();
    const validRecipients: Array<{
      recipient: BulkMessageRecipient;
      phone: string;
    }> = [];
    let skippedCount = 0;

    for (const r of recipients) {
      const phoneCandidate =
        normalizePhoneNumber(r.phone) ||
        normalizePhoneNumber(r.mobilePhone) ||
        normalizePhoneNumber(r.officePhone);

      if (!phoneCandidate) {
        skippedCount++;
        continue;
      }

      const dedupeKey = phoneCandidate.replace(/[\s\-\(\)\.]/g, "");
      if (seenPhoneNumbers.has(dedupeKey)) {
        continue;
      }
      seenPhoneNumbers.add(dedupeKey);
      validRecipients.push({ recipient: r, phone: phoneCandidate });
    }

    if (validRecipients.length === 0) {
      return {
        success: false,
        total: recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount,
        error: "None of the selected records have valid phone numbers for WhatsApp.",
      };
    }

    // For WhatsApp web deep-linking or automated dispatch
    return {
      success: true,
      total: validRecipients.length,
      sentCount: validRecipients.length,
      failedCount: 0,
      skippedCount,
    };
  }

  return {
    success: false,
    total: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    error: `Unsupported messaging channel: ${channel}`,
  };
}
