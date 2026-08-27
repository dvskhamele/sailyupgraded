import {
  cleanWhatsAppPhoneNumber,
  getContactRawPhone,
  getContactDisplayName,
  processContactsForWhatsApp,
  buildWhatsAppWebExtensionUrl,
  type ContactPhoneSource,
} from "@/lib/whatsapp-extension";
import type { PeopleRecord } from "@/types/people";

describe("People WhatsApp Browser Extension Integration", () => {
  const mockPeopleRecords: PeopleRecord[] = [
    {
      id: "con-1",
      originalId: "1",
      type: "Contact",
      name: "Rahul Sharma",
      fullName: "Rahul Sharma",
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
      phone: "+91 97527 88803",
      mobilePhone: "+91 97527 88803",
      company: "Acme Corp",
      raw: {},
    },
    {
      id: "con-2",
      originalId: "2",
      type: "Contact",
      name: "Amit Sharma",
      fullName: "Amit Sharma",
      firstName: "Amit",
      lastName: "Sharma",
      email: "amit@example.com",
      phone: "+91 9876543210",
      mobilePhone: "+91 9876543210",
      company: "Beta Ltd",
      raw: {},
    },
    {
      id: "con-3",
      originalId: "3",
      type: "Contact",
      name: "Raj Sharma",
      fullName: "Raj Sharma",
      firstName: "Raj",
      lastName: "Sharma",
      email: "raj@example.com",
      phone: "+91 9999999999",
      mobilePhone: "+91 9999999999",
      company: "Gamma Inc",
      raw: {},
    },
    {
      id: "acc-1",
      originalId: "101",
      type: "Account",
      name: "Acme Global Industries",
      fullName: "Acme Global Industries",
      company: "Acme Global Industries",
      email: "info@acmeglobal.com",
      phone: "+91 91234 56789",
      officePhone: "+91 91234 56789",
      raw: {},
    },
    {
      id: "con-4",
      originalId: "4",
      type: "Contact",
      name: "NoPhone Person",
      fullName: "NoPhone Person",
      firstName: "NoPhone",
      lastName: "Person",
      email: "nophone@example.com",
      phone: "",
      mobilePhone: undefined,
      officePhone: undefined,
      raw: {},
    },
    {
      id: "acc-2",
      originalId: "102",
      type: "Account",
      name: "NoPhone Account",
      fullName: "NoPhone Account",
      phone: "unavailable",
      raw: {},
    },
    {
      id: "con-5",
      originalId: "5",
      type: "Contact",
      name: "DuplicatePhone Person",
      fullName: "DuplicatePhone Person",
      phone: "+91 97527 88803", // Duplicate of con-1
      raw: {},
    },
    {
      id: "con-6",
      originalId: "6",
      type: "Contact",
      name: "FormattedPhone Person",
      fullName: "FormattedPhone Person",
      phone: "+1 (555) 010-1234",
      raw: {},
    },
  ];

  describe("Requirement 1 & 2: Single and Multiple People Selection", () => {
    it("Test 1: Select one Person -> WhatsApp processes single valid person", () => {
      const result = processContactsForWhatsApp([mockPeopleRecords[0]]);
      expect(result.validRecipients).toHaveLength(1);
      expect(result.validRecipients[0].name).toBe("Rahul Sharma");
      expect(result.validRecipients[0].cleanPhone).toBe("919752788803");
      expect(result.skippedContacts).toHaveLength(0);
      expect(result.uniquePhoneNumbers).toEqual(["919752788803"]);
      expect(result.extPhoneParam).toBe("919752788803");
    });

    it("Test 2: Select multiple People -> WhatsApp collects all valid numbers", () => {
      const result = processContactsForWhatsApp([
        mockPeopleRecords[0],
        mockPeopleRecords[1],
        mockPeopleRecords[2],
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
  });

  describe("Requirement 3 & 4: Contact-type and Account-type Records", () => {
    it("Test 3: Contact-type Person with phone is extracted properly", () => {
      const result = processContactsForWhatsApp([mockPeopleRecords[0]]);
      expect(result.validRecipients[0].name).toBe("Rahul Sharma");
      expect(result.validRecipients[0].cleanPhone).toBe("919752788803");
    });

    it("Test 4: Account-type Person with phone is extracted properly", () => {
      const result = processContactsForWhatsApp([mockPeopleRecords[3]]);
      expect(result.validRecipients).toHaveLength(1);
      expect(result.validRecipients[0].name).toBe("Acme Global Industries");
      expect(result.validRecipients[0].cleanPhone).toBe("919123456789");
    });

    it("Handles mixed Account and Contact records together", () => {
      const result = processContactsForWhatsApp([
        mockPeopleRecords[0], // Contact: Rahul Sharma
        mockPeopleRecords[3], // Account: Acme Global Industries
      ]);
      expect(result.validRecipients).toHaveLength(2);
      expect(result.uniquePhoneNumbers).toEqual([
        "919752788803",
        "919123456789",
      ]);
      expect(result.extPhoneParam).toBe("919752788803,919123456789");
    });
  });

  describe("Requirement 5, 6 & 7: Missing, Invalid, and Duplicate Phone Numbers", () => {
    it("Test 5 & 6: Missing and invalid phone numbers are skipped with accurate report", () => {
      const selected = [
        mockPeopleRecords[0], // valid 919752788803
        mockPeopleRecords[1], // valid 919876543210
        mockPeopleRecords[2], // valid 919999999999
        mockPeopleRecords[4], // missing phone
        mockPeopleRecords[5], // unavailable
      ];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(3);
      expect(result.skippedContacts).toHaveLength(2);
      expect(result.skippedContacts.map((s) => s.name)).toEqual([
        "NoPhone Person",
        "NoPhone Account",
      ]);
      expect(result.uniquePhoneNumbers).toEqual([
        "919752788803",
        "919876543210",
        "919999999999",
      ]);
    });

    it("Test 7: Duplicate phone numbers across multiple People are deduplicated in URL param", () => {
      const selected = [
        mockPeopleRecords[0], // 919752788803
        mockPeopleRecords[6], // 919752788803 (duplicate)
        mockPeopleRecords[1], // 919876543210
      ];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(3); // 3 recipients displayed in list
      expect(result.uniquePhoneNumbers).toHaveLength(2); // 2 unique numbers in ext_phone
      expect(result.uniquePhoneNumbers).toEqual(["919752788803", "919876543210"]);
      expect(result.extPhoneParam).toBe("919752788803,919876543210");
    });

    it("Handles zero valid phone numbers", () => {
      const selected = [mockPeopleRecords[4], mockPeopleRecords[5]];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(0);
      expect(result.skippedContacts).toHaveLength(2);
      expect(result.uniquePhoneNumbers).toHaveLength(0);
      expect(result.extPhoneParam).toBe("");
    });
  });

  describe("Requirement 8, 9, 10 & 14: URL Construction, Encoding & Message Content", () => {
    it("Test 8: Message containing spaces", () => {
      const url = buildWhatsAppWebExtensionUrl(
        "919752788803,919876543210",
        "Hello Ji"
      );
      expect(url).toBe(
        "https://web.whatsapp.com/?ext_phone=919752788803,919876543210&ext_msg=Hello%20Ji&ext_send=true"
      );
    });

    it("Test 9: Message containing emojis", () => {
      const message = "Hello from People page! 👋 🎉 🚀";
      const url = buildWhatsAppWebExtensionUrl(
        ["919752788803", "919876543210"],
        message
      );
      expect(url).toContain(
        `ext_msg=${encodeURIComponent(message)}`
      );
      expect(url).toContain("ext_send=true");
    });

    it("Test 10: Message containing &, ?, #, %, / and special characters", () => {
      const message = "People CRM promo: 50% off #special & new features / Q3?";
      const url = buildWhatsAppWebExtensionUrl("919752788803", message);
      expect(url).toBe(
        `https://web.whatsapp.com/?ext_phone=919752788803&ext_msg=${encodeURIComponent(message)}&ext_send=true`
      );
    });

    it("Test 14: Matches exact final UX extension URL format", () => {
      const numbers = ["919752788803", "919876543210", "919999999999"];
      const message = "Hello, I wanted to connect with you.";
      const url = buildWhatsAppWebExtensionUrl(numbers, message);

      expect(url).toBe(
        "https://web.whatsapp.com/?ext_phone=919752788803,919876543210,919999999999&ext_msg=Hello%2C%20I%20wanted%20to%20connect%20with%20you.&ext_send=true"
      );
    });
  });

  describe("Requirement 17 & 18: Cross-module Parity (Contacts, Leads, People)", () => {
    it("Verifies Contacts, Leads, and People share the identical URL builder and normalization", () => {
      const personItem: ContactPhoneSource = {
        fullName: "Rahul Sharma",
        phone: "+91 97527 88803",
      };
      const leadItem: ContactPhoneSource = {
        firstName: "Rahul",
        lastName: "Sharma",
        phone: "+91 97527 88803",
      };
      const contactItem: ContactPhoneSource = {
        first_name: "Rahul",
        last_name: "Sharma",
        mobile_phone: "+91 97527 88803",
      };

      const personProcessed = processContactsForWhatsApp([personItem]);
      const leadProcessed = processContactsForWhatsApp([leadItem]);
      const contactProcessed = processContactsForWhatsApp([contactItem]);

      expect(personProcessed.uniquePhoneNumbers).toEqual(leadProcessed.uniquePhoneNumbers);
      expect(leadProcessed.uniquePhoneNumbers).toEqual(contactProcessed.uniquePhoneNumbers);

      const msg = "Uniform multi-module WhatsApp test";
      const personUrl = buildWhatsAppWebExtensionUrl(personProcessed.uniquePhoneNumbers, msg);
      const leadUrl = buildWhatsAppWebExtensionUrl(leadProcessed.uniquePhoneNumbers, msg);
      const contactUrl = buildWhatsAppWebExtensionUrl(contactProcessed.uniquePhoneNumbers, msg);

      expect(personUrl).toBe(leadUrl);
      expect(leadUrl).toBe(contactUrl);
    });
  });
});
