import { sendBulkMessages, type BulkMessageRecipient } from "@/actions/crm/messages/send-bulk-messages";
import { resolveMergeTags } from "@/lib/campaigns/merge-tags";

// Mock dependencies
jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "user-test-1", email: "admin@saily.test", name: "Admin" },
  }),
}));

jest.mock("@/actions/crm/sms/send-sms", () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true, sid: "SM-mock-123" }),
}));

jest.mock("@/lib/integrations/twilio", () => ({
  getTwilioIntegration: jest.fn().mockResolvedValue({
    accountSid: "AC-test-123",
    authToken: "token-test-123",
    phoneNumber: "+15550001111",
  }),
}));

jest.mock("@/lib/email/smtp2go", () => ({
  sendSmtp2GoEmail: jest.fn().mockResolvedValue({ success: true }),
}));

describe("Contacts Page Bulk Actions (Email, Send Message, WhatsApp)", () => {
  // Sample contact items as returned by getContacts / DB
  const mockRawContacts = [
    {
      id: "contact-1",
      first_name: "Rahul",
      last_name: "Sharma",
      email: "rahul@example.com",
      personal_email: null,
      mobile_phone: "+1 555-0101",
      office_phone: null,
      company: "Acme Corp",
      position: "Product Lead",
      role: "CUSTOMER",
    },
    {
      id: "contact-2",
      first_name: "Priya",
      last_name: "Patel",
      email: "priya@example.com",
      personal_email: "priya.personal@example.com",
      mobile_phone: null,
      office_phone: "+1 555-0102",
      company: "TechNova",
      position: "Founder",
      role: "CUSTOMER",
    },
    {
      id: "contact-3",
      first_name: "NoPhone",
      last_name: "Contact",
      email: "nophone@example.com",
      personal_email: null,
      mobile_phone: null,
      office_phone: "",
      company: "EmailOnly Inc",
      position: "Developer",
      role: "CUSTOMER",
    },
    {
      id: "contact-4",
      first_name: "NoEmail",
      last_name: "Contact",
      email: "",
      personal_email: null,
      mobile_phone: "+1 555-0104",
      office_phone: null,
      company: "PhoneOnly Inc",
      position: "Sales",
      role: "CUSTOMER",
    },
    {
      id: "contact-5",
      first_name: "Rahul",
      last_name: "DuplicatePhone",
      email: "rahul.dupe@example.com",
      personal_email: null,
      mobile_phone: "+1 555-0101", // Duplicate of contact-1 phone
      office_phone: null,
      company: "Acme Corp",
      position: "Product Lead",
      role: "CUSTOMER",
    },
  ];

  // Helper to normalize raw contacts to BulkMessageRecipient (same logic as in ContactsDataTable)
  function normalizeContactToRecipient(c: (typeof mockRawContacts)[0]): BulkMessageRecipient {
    const firstName = c.first_name || "";
    const lastName = c.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Contact";
    const phone = c.mobile_phone || c.office_phone || null;
    const email = c.email || c.personal_email || null;

    return {
      id: c.id,
      originalId: c.id,
      name: fullName,
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      personalEmail: c.personal_email || undefined,
      phone: phone || undefined,
      mobilePhone: c.mobile_phone || undefined,
      officePhone: c.office_phone || undefined,
      company: companyName(c),
      jobTitle: c.position || undefined,
      type: "Contact",
    };
  }

  function companyName(c: (typeof mockRawContacts)[0]): string | undefined {
    return c.company || undefined;
  }

  const normalizedRecipients = mockRawContacts.map(normalizeContactToRecipient);

  describe("Contact Normalization & Validation", () => {
    it("correctly maps contact properties to BulkMessageRecipient format", () => {
      const recipient = normalizeContactToRecipient(mockRawContacts[0]);
      expect(recipient.id).toBe("contact-1");
      expect(recipient.name).toBe("Rahul Sharma");
      expect(recipient.firstName).toBe("Rahul");
      expect(recipient.lastName).toBe("Sharma");
      expect(recipient.email).toBe("rahul@example.com");
      expect(recipient.phone).toBe("+1 555-0101");
      expect(recipient.company).toBe("Acme Corp");
      expect(recipient.jobTitle).toBe("Product Lead");
      expect(recipient.type).toBe("Contact");
    });

    it("falls back to office_phone when mobile_phone is null", () => {
      const recipient = normalizeContactToRecipient(mockRawContacts[1]);
      expect(recipient.phone).toBe("+1 555-0102");
    });
  });

  describe("Send Message (SMS) with Contacts", () => {
    it("successfully sends personalized SMS to valid contacts", async () => {
      const { sendSMS } = require("@/actions/crm/sms/send-sms");
      jest.clearAllMocks();

      const result = await sendBulkMessages({
        channel: "sms",
        recipients: normalizedRecipients,
        message: "Hi {{firstName}}, updates regarding {{company}}.",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(3); // contact-1, contact-2, contact-4 (contact-5 is dupe of 1, contact-3 has no phone)
      expect(result.skippedCount).toBe(1); // contact-3 has no phone
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+1 555-0101",
        message: "Hi Rahul, updates regarding Acme Corp.",
        contactId: "contact-1",
      });
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+1 555-0102",
        message: "Hi Priya, updates regarding TechNova.",
        contactId: "contact-2",
      });
      expect(sendSMS).toHaveBeenCalledWith({
        to: "+1 555-0104",
        message: "Hi NoEmail, updates regarding PhoneOnly Inc.",
        contactId: "contact-4",
      });
    });

    it("fails gracefully when all selected contacts are missing phone numbers", async () => {
      const noPhoneRecipients = [normalizeContactToRecipient(mockRawContacts[2])];
      const result = await sendBulkMessages({
        channel: "sms",
        recipients: noPhoneRecipients,
        message: "Hello {{firstName}}!",
      });

      expect(result.success).toBe(false);
      expect(result.sentCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.error).toContain("None of the selected records have valid phone numbers");
    });
  });

  describe("WhatsApp Integration with Contacts", () => {
    it("validates and batches valid contacts for WhatsApp delivery", async () => {
      const result = await sendBulkMessages({
        channel: "whatsapp",
        recipients: normalizedRecipients,
        message: "Hello {{firstName}}, greetings from {{company}}!",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(3); // 3 unique valid phone numbers
      expect(result.skippedCount).toBe(1); // contact-3 skipped due to missing phone
    });

    it("generates correct WhatsApp click-to-chat URL for single contact", () => {
      const singleContact = normalizedRecipients[0];
      const rawPhone = singleContact.phone?.replace(/\D/g, "");
      const message = resolveMergeTags("Hi {{firstName}}, let's connect!", {
        firstName: singleContact.firstName,
      });
      const encodedMsg = encodeURIComponent(message);
      const waUrl = `https://wa.me/${rawPhone}?text=${encodedMsg}`;

      expect(waUrl).toBe("https://wa.me/15550101?text=Hi%20Rahul%2C%20let's%20connect!");
    });

    it("rejects WhatsApp dispatch when no contacts have valid phone numbers", async () => {
      const noPhoneRecipients = [normalizeContactToRecipient(mockRawContacts[2])];
      const result = await sendBulkMessages({
        channel: "whatsapp",
        recipients: noPhoneRecipients,
        message: "Hello!",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("None of the selected records have valid phone numbers for WhatsApp");
    });
  });

  describe("Send Email with Contacts", () => {
    it("filters and deduplicates valid email addresses", () => {
      const emails = normalizedRecipients
        .map((r) => r.email?.trim())
        .filter((e): e is string => Boolean(e && e.includes("@")));
      const uniqueEmails = Array.from(new Set(emails));

      expect(uniqueEmails).toHaveLength(4); // contact-1, contact-2, contact-3, contact-5 (contact-4 skipped)
      expect(uniqueEmails).not.toContain("");
    });
  });
});
