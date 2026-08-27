import {
  cleanWhatsAppPhoneNumber,
  getContactRawPhone,
  getContactDisplayName,
  processContactsForWhatsApp,
  buildWhatsAppWebExtensionUrl,
  type ContactPhoneSource,
} from "@/lib/whatsapp-extension";

describe("Leads WhatsApp Browser Extension Integration", () => {
  const mockLeads: ContactPhoneSource[] = [
    {
      id: "lead-1",
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
      phone: "+91 97527 88803",
      company: "Acme Corp",
    },
    {
      id: "lead-2",
      firstName: "Amit",
      lastName: "Sharma",
      email: "amit@example.com",
      phone: "+91 9876543210",
      company: "Beta Ltd",
    },
    {
      id: "lead-3",
      firstName: "Raj",
      lastName: "Sharma",
      email: "raj@example.com",
      phone: "+91 9999999999",
      company: "Gamma Inc",
    },
    {
      id: "lead-4",
      firstName: "NoPhone",
      lastName: "Lead",
      email: "nophone@example.com",
      phone: null,
      mobile_phone: "",
      office_phone: null,
      company: "NoPhone Co",
    },
    {
      id: "lead-5",
      firstName: "DuplicatePhone",
      lastName: "Lead",
      email: "dupe@example.com",
      phone: "+91 97527 88803", // Duplicate of lead-1
      company: "Dupe Co",
    },
    {
      id: "lead-6",
      firstName: "FormattedPhone",
      lastName: "Lead",
      email: "formatted@example.com",
      phone: "+1 (555) 010-1234",
      company: "Format Co",
    },
    {
      id: "lead-7",
      firstName: "InvalidPlaceholder",
      lastName: "Lead",
      email: "invalid@example.com",
      phone: "unavailable",
      company: "Invalid Co",
    },
  ];

  describe("Lead Data Extraction & Normalization", () => {
    it("Test 1: Select one Lead -> WhatsApp processes single lead correctly", () => {
      const result = processContactsForWhatsApp([mockLeads[0]]);
      expect(result.validRecipients).toHaveLength(1);
      expect(result.validRecipients[0].name).toBe("Rahul Sharma");
      expect(result.validRecipients[0].cleanPhone).toBe("919752788803");
      expect(result.skippedContacts).toHaveLength(0);
      expect(result.uniquePhoneNumbers).toEqual(["919752788803"]);
      expect(result.extPhoneParam).toBe("919752788803");
    });

    it("Test 2: Select multiple Leads -> WhatsApp collects all valid numbers", () => {
      const result = processContactsForWhatsApp([
        mockLeads[0],
        mockLeads[1],
        mockLeads[2],
      ]);
      expect(result.validRecipients).toHaveLength(3);
      expect(result.validRecipients.map((r) => r.name)).toEqual([
        "Rahul Sharma",
        "Amit Sharma",
        "Raj Sharma",
      ]);
      expect(result.uniquePhoneNumbers).toEqual([
        "919752788803",
        "919876543210",
        "919999999999",
      ]);
      expect(result.extPhoneParam).toBe(
        "919752788803,919876543210,919999999999"
      );
    });

    it("Test 3: Lead with +91 phone number", () => {
      const clean = cleanWhatsAppPhoneNumber(mockLeads[0].phone);
      expect(clean).toBe("919752788803");
    });

    it("Test 4: Lead with formatted number with parentheses, spaces, dashes", () => {
      const clean = cleanWhatsAppPhoneNumber(mockLeads[5].phone);
      expect(clean).toBe("15550101234");
    });

    it("Test 5: Lead without phone number is skipped and reported", () => {
      const selected = [
        mockLeads[0], // valid 919752788803
        mockLeads[1], // valid 919876543210
        mockLeads[2], // valid 919999999999
        mockLeads[3], // no phone
        mockLeads[6], // invalid placeholder
      ];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(3);
      expect(result.skippedContacts).toHaveLength(2);
      expect(result.skippedContacts.map((s) => s.name)).toEqual([
        "NoPhone Lead",
        "InvalidPlaceholder Lead",
      ]);
      expect(result.uniquePhoneNumbers).toEqual([
        "919752788803",
        "919876543210",
        "919999999999",
      ]);
    });

    it("Test 6: Duplicate phone numbers across multiple leads are deduplicated in URL param", () => {
      const selected = [
        mockLeads[0], // 919752788803
        mockLeads[4], // 919752788803 (duplicate)
        mockLeads[1], // 919876543210
      ];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(3); // 3 recipients displayed in modal
      expect(result.uniquePhoneNumbers).toHaveLength(2); // 2 unique numbers in ext_phone
      expect(result.uniquePhoneNumbers).toEqual(["919752788803", "919876543210"]);
      expect(result.extPhoneParam).toBe("919752788803,919876543210");
    });
  });

  describe("URL Construction & Message Safety", () => {
    it("Test 8: Message containing emojis", () => {
      const url = buildWhatsAppWebExtensionUrl(
        ["919752788803", "919876543210"],
        "Hello from Leads CRM! 👋 🚀 ✨"
      );
      expect(url).toContain("ext_phone=919752788803,919876543210");
      expect(url).toContain(
        `ext_msg=${encodeURIComponent("Hello from Leads CRM! 👋 🚀 ✨")}`
      );
      expect(url).toContain("ext_send=true");
    });

    it("Test 9: Message containing &, ?, #, %, / and special characters", () => {
      const message = "Connecting regarding Q3 & Q4? Price: 100% #lead / promo";
      const url = buildWhatsAppWebExtensionUrl("919752788803", message);
      expect(url).toBe(
        `https://web.whatsapp.com/?ext_phone=919752788803&ext_msg=${encodeURIComponent(message)}&ext_send=true`
      );
    });

    it("Test 12: Matches exact final UX extension URL format", () => {
      const numbers = ["919752788803", "919876543210", "919999999999"];
      const message = "Hello, I wanted to connect with you.";
      const url = buildWhatsAppWebExtensionUrl(numbers, message);

      expect(url).toBe(
        "https://web.whatsapp.com/?ext_phone=919752788803,919876543210,919999999999&ext_msg=Hello%2C%20I%20wanted%20to%20connect%20with%20you.&ext_send=true"
      );
    });

    it("Test 14: Verifies Contacts and Leads share the exact same URL generator and normalization", () => {
      const leadItem = {
        firstName: "Rahul",
        lastName: "Sharma",
        phone: "+91 97527 88803",
      };
      const contactItem = {
        first_name: "Rahul",
        last_name: "Sharma",
        mobile_phone: "+91 97527 88803",
      };

      const leadProcessed = processContactsForWhatsApp([leadItem]);
      const contactProcessed = processContactsForWhatsApp([contactItem]);

      expect(leadProcessed.uniquePhoneNumbers).toEqual(contactProcessed.uniquePhoneNumbers);
      expect(leadProcessed.validRecipients[0].cleanPhone).toBe(
        contactProcessed.validRecipients[0].cleanPhone
      );
      expect(leadProcessed.validRecipients[0].name).toBe(
        contactProcessed.validRecipients[0].name
      );

      const msg = "Shared message test";
      const leadUrl = buildWhatsAppWebExtensionUrl(leadProcessed.uniquePhoneNumbers, msg);
      const contactUrl = buildWhatsAppWebExtensionUrl(contactProcessed.uniquePhoneNumbers, msg);

      expect(leadUrl).toBe(contactUrl);
    });
  });
});
