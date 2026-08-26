"use server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { getTwilioIntegration } from "@/lib/integrations/twilio";

export type MessageTemplate = {
  id: string;
  name: string;
  description: string | null;
  subject_default: string | null;
  content_html: string;
};

export type MessagingChannelsConfig = {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
  twilioPhoneNumber?: string;
  defaultEmailFrom?: string;
};

export type MessageConfigResponse = {
  channels: MessagingChannelsConfig;
  templates: MessageTemplate[];
};

export async function getMessageConfig(): Promise<MessageConfigResponse> {
  const session = await getSession();
  const userId = session?.user?.id as string | undefined;

  let isSmsConfigured = false;
  let twilioPhoneNumber: string | undefined;

  try {
    const twilioIntegration = await getTwilioIntegration(userId);
    if (
      twilioIntegration?.accountSid &&
      twilioIntegration?.authToken &&
      twilioIntegration?.phoneNumber
    ) {
      isSmsConfigured = true;
      twilioPhoneNumber = twilioIntegration.phoneNumber;
    } else if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    ) {
      isSmsConfigured = true;
      twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    }
  } catch (err) {
    console.error("[GET_MESSAGE_CONFIG_TWILIO_ERROR]", err);
    isSmsConfigured = false;
  }

  let isEmailConfigured = false;
  try {
    if (process.env.SMTP2GO_API_KEY || process.env.RESEND_API_KEY) {
      isEmailConfigured = true;
    } else {
      const emailIntegration = await prismadb.integration.findFirst({
        where: {
          provider: { in: ["SMTP2GO", "RESEND"] },
          isActive: true,
        },
      });
      if (emailIntegration) {
        isEmailConfigured = true;
      }
    }
  } catch (err) {
    console.error("[GET_MESSAGE_CONFIG_EMAIL_ERROR]", err);
    isEmailConfigured = true; // Fallback
  }

  // Load message/campaign templates
  let templates: MessageTemplate[] = [];
  try {
    const rawTemplates = await prismadb.crm_campaign_templates.findMany({
      where: { deletedAt: null },
      orderBy: { created_on: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        subject_default: true,
        content_html: true,
      },
      take: 50,
    });

    templates = rawTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      subject_default: t.subject_default,
      content_html: t.content_html,
    }));
  } catch (err) {
    console.error("[GET_MESSAGE_CONFIG_TEMPLATES_ERROR]", err);
    templates = [];
  }

  return {
    channels: {
      sms: isSmsConfigured,
      email: isEmailConfigured,
      whatsapp: true, // Click-to-chat web/mobile deep link is supported for valid numbers
      twilioPhoneNumber,
    },
    templates,
  };
}
