import { sendBulkMessages, type BulkMessageRecipient } from "@/actions/crm/messages/send-bulk-messages";
import { getMessageConfig } from "@/actions/crm/messages/get-message-config";
import { resolveMergeTags } from "@/lib/campaigns/merge-tags";

// Mock dependencies
jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "user-leads-test", email: "admin@saily.test", name: "Admin" },
  }),
}));

jest.mock("@/actions/crm/sms/send-sms", () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true, sid: "SM-lead-mock-123" }),
}));

jest.mock("@/lib/integrations/twilio", () => ({
  getTwilioIntegration: jest.fn().mockResolvedValue({
    accountSid: "AC-leads-test",
    authToken: "token-leads-test",
    phoneNumber: "+15550009999",
  }),
}));

jest.mock("@/lib/email/smtp2go", () => ({
  sendSmtp2GoEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    integration: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    crm_campaign_templates: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "tpl-lead-1",
          name: "Lead Follow-up SMS",
          description: "Follow-up for inbound leads",
          subject_default: "Following up",
          content_html: "<p>Hi {{firstName}}, thanks for checking out {{company}}!</p>",
        },
      ]),
    },
  },
}));

describe("Leads Bulk Send Message Feature", () => {
  // Sample leads as returned by getCrmData / Prisma
  const mockRawLeads = [
    {
      id: "lead-1",
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
      personal_email: null,
      phone: "+91 97527 88803",
      mobile_phone: null,
      office_phone: null,
      company: "Acme Corp",
      position: "CTO",
      jobTitle: "CTO",
      role: "DECISION_MAKER",
    },
    {
      id: "lead-2",
      firstName: "Amit",
      lastName: "Sharma",
      email: "amit@example.com",
      personal_email: "amit.personal@example.com",
      phone: null,
      mobile_phone: "+91 98765 43210",
      office_phone: null,
      company: "Beta Tech",
      position: "VP Sales",
      jobTitle: "VP Sales",
      role: "DECISION_MAKER",
    },
    {
      id: "lead-3",
      firstName: "Raj",
      lastName: "Sharma",
      email: "raj@example.com",
      personal_email: null,
      phone: null,
      mobile_phone: null,
      office_phone: null,
      company: "Gamma Global",
      position: "Director",
      jobTitle: "Director",
      role: "DECISION_MAKER",
    },
    {
      id: "lead-4",
      firstName: "NoEmail",
      lastName: "Lead",
      email: "",
      personal_email: null,
      phone: "+1 555-0199",
      mobile_phone: null,
      office_phone: null,
      company: "PhoneOnly Corp",
      position: "Manager",
      jobTitle: "Manager",
      role: "CONTACT",
    },
    {
      id: "lead-5",
      firstName: "Rahul",
      lastName: "DuplicatePhone",
      email: "rahul.dupe@example.com",
      personal_email: null,
      phone: "+91 97527 88803", // Duplicate phone of lead-1
      mobile_phone: null,
      office_phone: null,
      company: "Acme Corp",
      position: "CTO",
      jobTitle: "CTO",
      role: "DECISION_MAKER",
    },
  ];

  // Helper to normalize lead to BulkMessageRecipient (matching LeadDataTable logic)
  function normalizeLeadToRecipient(lead: (typeof mockRawLeads)[0]): BulkMessageRecipient {
    const firstName = lead.firstName || (lead as any).name?.split(" ")[0] || "";
    const lastName =
      lead.lastName ||
      ((lead as any).name && (lead as any).name.split(" ").length > 1
        ? (lead as any).name.split(" ").slice(1).join(" ")
        : "");
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Lead";
    const phone = lead.mobile_phone || lead.phone || lead.office_phone || null;
    const email = lead.email || lead.personal_email || null;

    return {
      id: lead.id,
      originalId: lead.id,
      name: fullName,
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      personalEmail: lead.personal_email || undefined,
      phone: phone || undefined,
      mobilePhone: lead.mobile_phone || undefined,
      officePhone: lead.office_phone || undefined,
      company: lead.company || undefined,
      jobTitle: lead.jobTitle || lead.position || undefined,
      type: "Lead",
    };
  }

  const normalizedRecipients = mockRawLeads.map(normalizeLeadToRecipient);

  describe("Lead Recipient Normalization & Field Mapping", () => {
    it("correctly maps lead fields to BulkMessageRecipient format", () => {
      const recipient = normalizeLeadToRecipient(mockRawLeads[0]);
      expect(recipient.id).toBe("lead-1");
      expect(recipient.name).toBe("Rahul Sharma");
      expect(recipient.firstName).toBe("Rahul");
      expect(recipient.lastName).toBe("Sharma");
      expect(recipient.email).toBe("rahul@example.com");
      expect(recipient.phone).toBe("+91 97527 88803");
      expect(recipient.company).toBe("Acme Corp");
      expect(recipient.jobTitle).toBe("CTO");
      expect(recipient.type).toBe("Lead");
    });

    it("falls back to mobile_phone when phone is null", () => {
      const recipient = normalizeLeadToRecipient(mockRawLeads[1]);
      expect(recipient.phone).toBe("+91 98765 43210");
    });
  });

  describe("Personalization Variables with Leads", () => {
    it("correctly resolves lead personalization variables: {{firstName}}, {{lastName}}, {{company}}, {{email}}, {{phone}}", () => {
      const lead = normalizedRecipients[0];
      const template = "Hi {{firstName}} {{lastName}} from {{company}}! We received your inquiry at {{email}} or {{phone}}.";
      const resolved = resolveMergeTags(template, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
      });

      expect(resolved).toBe(
        "Hi Rahul Sharma from Acme Corp! We received your inquiry at rahul@example.com or +91 97527 88803."
      );
    });
  });

  describe("Send Message (SMS) with Leads", () => {
    it("sends personalized SMS messages to selected leads with valid phones", async () => {
      const { sendSMS } = require("@/actions/crm/sms/send-sms");
      jest.clearAllMocks();

      // User selects Rahul (lead-1) and Amit (lead-2)
      const selected = [normalizedRecipients[0], normalizedRecipients[1]];

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: selected,
        message: "Hi {{firstName}}, follow up regarding {{company}}.",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(sendSMS).toHaveBeenCalledTimes(2);
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+91 97527 88803",
        message: "Hi Rahul, follow up regarding Acme Corp.",
        contactId: undefined, // Leads do not pass contactId
      });
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+91 98765 43210",
        message: "Hi Amit, follow up regarding Beta Tech.",
        contactId: undefined,
      });
    });

    it("skips leads without valid phone numbers and reports skipped count", async () => {
      // User selects Rahul (has phone), Raj (no phone), NoEmail (has phone)
      const selected = [
        normalizedRecipients[0], // lead-1 (has phone)
        normalizedRecipients[2], // lead-3 (no phone)
        normalizedRecipients[3], // lead-4 (has phone)
      ];

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: selected,
        message: "Hello {{firstName}}!",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(result.skippedCount).toBe(1); // lead-3 skipped
    });

    it("deduplicates leads sharing the same phone number", async () => {
      const { sendSMS } = require("@/actions/crm/sms/send-sms");
      jest.clearAllMocks();

      // lead-1 and lead-5 share phone +91 97527 88803
      const selected = [normalizedRecipients[0], normalizedRecipients[4]];

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: selected,
        message: "Hi {{firstName}}!",
      });

      expect(result.sentCount).toBe(1);
      expect(sendSMS).toHaveBeenCalledTimes(1);
    });

    it("errors when all selected leads have no valid phone numbers", async () => {
      const selected = [normalizedRecipients[2]]; // lead-3 has no phone

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: selected,
        message: "Hello!",
      });

      expect(result.success).toBe(false);
      expect(result.sentCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.error).toContain("None of the selected records have valid phone numbers");
    });
  });

  describe("Send Message (Email) with Leads", () => {
    it("sends personalized emails to selected leads with valid emails", async () => {
      const { sendSmtp2GoEmail } = require("@/lib/email/smtp2go");
      jest.clearAllMocks();

      const selected = [
        normalizedRecipients[0], // lead-1
        normalizedRecipients[1], // lead-2
      ];

      const result = await sendBulkMessages({
        channel: "email",
        recipients: selected,
        subject: "Welcome {{firstName}} from {{company}}",
        message: "Hi {{firstName}}, welcome to our platform!",
        fromEmail: "notifications@mail.bluetidefinancial.com",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(sendSmtp2GoEmail).toHaveBeenCalledTimes(2);
      expect(sendSmtp2GoEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: "rahul@example.com",
          subject: "Welcome Rahul from Acme Corp",
          message: "Hi Rahul, welcome to our platform!",
        })
      );
    });

    it("skips leads without email addresses when sending emails", async () => {
      const selected = [
        normalizedRecipients[0], // lead-1 (has email)
        normalizedRecipients[3], // lead-4 (no email)
      ];

      const result = await sendBulkMessages({
        channel: "email",
        recipients: selected,
        subject: "Hello",
        message: "Hi {{firstName}}",
        fromEmail: "notifications@mail.bluetidefinancial.com",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(1);
      expect(result.skippedCount).toBe(1); // lead-4 skipped
    });
  });

  describe("WhatsApp with Leads", () => {
    it("processes valid lead recipients for WhatsApp broadcast", async () => {
      const selected = [
        normalizedRecipients[0], // lead-1
        normalizedRecipients[1], // lead-2
        normalizedRecipients[2], // lead-3 (no phone)
      ];

      const result = await sendBulkMessages({
        channel: "whatsapp",
        recipients: selected,
        message: "Hello {{firstName}} from {{company}}!",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("Backend Reuse Verification", () => {
    it("uses getMessageConfig to load channels and templates for Leads", async () => {
      const config = await getMessageConfig();
      expect(config.channels.sms).toBe(true);
      expect(config.channels.whatsapp).toBe(true);
      expect(config.templates.length).toBeGreaterThan(0);
    });
  });
});
