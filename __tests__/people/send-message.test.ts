import { resolveMergeTags } from "@/lib/campaigns/merge-tags";
import { sendBulkMessages, type BulkMessageRecipient } from "@/actions/crm/messages/send-bulk-messages";
import { getMessageConfig } from "@/actions/crm/messages/get-message-config";

// Mock dependencies
jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "user-123", email: "admin@example.com", name: "Admin" },
  }),
}));

jest.mock("@/actions/crm/sms/send-sms", () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true, sid: "SM12345" }),
}));

jest.mock("@/lib/integrations/twilio", () => ({
  getTwilioIntegration: jest.fn().mockResolvedValue({
    accountSid: "AC12345",
    authToken: "secret-token",
    phoneNumber: "+15550001111",
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
          id: "tpl-1",
          name: "Welcome SMS",
          description: "Greeting for new leads",
          subject_default: "Welcome",
          content_html: "<p>Hi {{firstName}}, welcome to {{company}}!</p>",
        },
      ]),
    },
  },
}));

describe("People Bulk Send Message Feature", () => {
  describe("Personalization Variables with resolveMergeTags", () => {
    it("correctly resolves camelCase personalization variables", () => {
      const template = "Hello {{firstName}} {{lastName}} from {{company}}! Reach us at {{email}} or {{phone}}.";
      const target = {
        firstName: "Rahul",
        lastName: "Sharma",
        company: "Acme Corp",
        email: "rahul@example.com",
        phone: "+1 555-0199",
      };

      const result = resolveMergeTags(template, target);
      expect(result).toBe("Hello Rahul Sharma from Acme Corp! Reach us at rahul@example.com or +1 555-0199.");
    });

    it("falls back gracefully when fields are missing", () => {
      const template = "Hi {{firstName}} {{lastName}} from {{company}}!";
      const target = {
        firstName: "Amit",
      };

      const result = resolveMergeTags(template, target);
      expect(result).toBe("Hi Amit  from !");
    });
  });

  describe("sendBulkMessages Action", () => {
    const mockRecipients: BulkMessageRecipient[] = [
      {
        id: "p-1",
        originalId: "c-1",
        name: "Rahul Sharma",
        firstName: "Rahul",
        lastName: "Sharma",
        phone: "+1 555-0101",
        email: "rahul@example.com",
        company: "Acme Corp",
        type: "Contact",
      },
      {
        id: "p-2",
        originalId: "c-2",
        name: "Amit Sharma",
        firstName: "Amit",
        lastName: "Sharma",
        phone: "+1 555-0102",
        email: "amit@example.com",
        company: "Global Tech",
        type: "Contact",
      },
      {
        id: "p-3",
        originalId: "c-3",
        name: "No Phone Contact",
        firstName: "NoPhone",
        lastName: "User",
        phone: "", // Missing phone
        email: "nophone@example.com",
        company: "Test Inc",
        type: "Contact",
      },
      {
        id: "p-4",
        originalId: "c-4",
        name: "Duplicate Rahul",
        firstName: "Rahul",
        lastName: "Sharma",
        phone: "+1 555-0101", // Duplicate phone of p-1
        email: "rahul.duplicate@example.com",
        company: "Acme Corp",
        type: "Contact",
      },
    ];

    it("validates and skips recipients missing phone numbers for SMS channel", async () => {
      const result = await sendBulkMessages({
        channel: "sms",
        recipients: mockRecipients,
        message: "Hi {{firstName}}, this is a test message from {{company}}.",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2); // p-1 and p-2
      expect(result.skippedCount).toBe(1); // p-3 (missing phone)
    });

    it("deduplicates recipients with the same phone number", async () => {
      const { sendSMS } = require("@/actions/crm/sms/send-sms");
      jest.clearAllMocks();

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: mockRecipients,
        message: "Hi {{firstName}}!",
      });

      expect(result.sentCount).toBe(2);
      expect(sendSMS).toHaveBeenCalledTimes(2);
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+1 555-0101",
        message: "Hi Rahul!",
        contactId: "c-1",
      });
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+1 555-0102",
        message: "Hi Amit!",
        contactId: "c-2",
      });
    });

    it("rejects empty message body", async () => {
      const result = await sendBulkMessages({
        channel: "sms",
        recipients: mockRecipients,
        message: "   ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Message body cannot be empty");
    });

    it("handles partial failure without throwing", async () => {
      const { sendSMS } = require("@/actions/crm/sms/send-sms");
      sendSMS.mockResolvedValueOnce({ error: "Invalid number format" });

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: [mockRecipients[0]],
        message: "Hello!",
      });

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.failures?.[0]?.error).toBe("Invalid number format");
    });
  });

  describe("getMessageConfig Action", () => {
    it("returns available channels and templates without exposing credentials", async () => {
      const config = await getMessageConfig();

      expect(config.channels.sms).toBe(true);
      expect(config.channels.whatsapp).toBe(true);
      // Ensure no raw secret auth tokens are exposed
      expect((config as any).authToken).toBeUndefined();
      expect((config.channels as any).authToken).toBeUndefined();
      expect(config.templates.length).toBeGreaterThan(0);
      expect(config.templates[0].name).toBe("Welcome SMS");
    });
  });
});
