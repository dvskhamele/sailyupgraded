import {
  cleanWhatsAppPhoneNumber,
  getContactRawPhone,
  getContactDisplayName,
  processContactsForWhatsApp,
  buildWhatsAppWebExtensionUrl,
  type ContactPhoneSource,
} from "@/lib/whatsapp-extension";

describe("WhatsApp Browser Extension Integration", () => {
  describe("Phone Number Cleaning & Normalization", () => {
    it("handles contact with +91 phone number and spaces", () => {
      expect(cleanWhatsAppPhoneNumber("+91 97527 88803")).toBe("919752788803");
      expect(cleanWhatsAppPhoneNumber("+91 9876543210")).toBe("919876543210");
      expect(cleanWhatsAppPhoneNumber("+91 99999 99999")).toBe("919999999999");
    });

    it("handles phone numbers with dashes, parentheses, dots and spaces", () => {
      expect(cleanWhatsAppPhoneNumber("+1 (555) 010-1234")).toBe("15550101234");
      expect(cleanWhatsAppPhoneNumber("(+44) 20 7946 0919")).toBe("442079460919");
      expect(cleanWhatsAppPhoneNumber("91-97527-88803")).toBe("919752788803");
      expect(cleanWhatsAppPhoneNumber("91.97527.88803")).toBe("919752788803");
    });

    it("preserves raw country code without plus", () => {
      expect(cleanWhatsAppPhoneNumber("919752788803")).toBe("919752788803");
      expect(cleanWhatsAppPhoneNumber("15550101234")).toBe("15550101234");
    });

    it("returns null for contact without phone number or empty values", () => {
      expect(cleanWhatsAppPhoneNumber(null)).toBeNull();
      expect(cleanWhatsAppPhoneNumber(undefined)).toBeNull();
      expect(cleanWhatsAppPhoneNumber("")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("   ")).toBeNull();
    });

    it("returns null for placeholder strings", () => {
      expect(cleanWhatsAppPhoneNumber("unavailable")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("null")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("undefined")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("none")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("n/a")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("NA")).toBeNull();
    });

    it("returns null for numbers with fewer than 5 digits", () => {
      expect(cleanWhatsAppPhoneNumber("123")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("+12")).toBeNull();
    });
  });

  describe("Contact Field Extraction & Display Names", () => {
    it("extracts phone by prioritizing mobile_phone, then phone, then office_phone", () => {
      const contact1: ContactPhoneSource = {
        mobile_phone: "+91 97527 88803",
        phone: "+91 11111 11111",
        office_phone: "+91 22222 22222",
      };
      expect(getContactRawPhone(contact1)).toBe("+91 97527 88803");

      const contact2: ContactPhoneSource = {
        mobile_phone: null,
        phone: "+91 11111 11111",
        office_phone: "+91 22222 22222",
      };
      expect(getContactRawPhone(contact2)).toBe("+91 11111 11111");

      const contact3: ContactPhoneSource = {
        mobile_phone: "",
        phone: null,
        office_phone: "+91 22222 22222",
      };
      expect(getContactRawPhone(contact3)).toBe("+91 22222 22222");

      const contact4: ContactPhoneSource = {
        mobile_phone: null,
        phone: null,
        office_phone: null,
      };
      expect(getContactRawPhone(contact4)).toBeNull();
    });

    it("derives contact display names correctly", () => {
      expect(
        getContactDisplayName({ first_name: "Rahul", last_name: "Sharma" })
      ).toBe("Rahul Sharma");
      expect(
        getContactDisplayName({ first_name: "Rahul", last_name: null })
      ).toBe("Rahul");
      expect(
        getContactDisplayName({ first_name: null, last_name: "Sharma" })
      ).toBe("Sharma");
      expect(
        getContactDisplayName({ name: "Amit Sharma" })
      ).toBe("Amit Sharma");
      expect(
        getContactDisplayName({})
      ).toBe("Contact");
    });
  });

  describe("Multiple Contacts Processing & Validation", () => {
    const mockContacts: ContactPhoneSource[] = [
      {
        id: "c-1",
        first_name: "Rahul",
        last_name: "Sharma",
        mobile_phone: "+91 97527 88803",
      },
      {
        id: "c-2",
        first_name: "Amit",
        last_name: "Sharma",
        mobile_phone: "+91 9876543210",
      },
      {
        id: "c-3",
        first_name: "Raj",
        last_name: "Sharma",
        mobile_phone: "+91 9999999999",
      },
      {
        id: "c-4",
        first_name: "NoPhone",
        last_name: "User",
        mobile_phone: null,
        phone: "",
        office_phone: null,
      },
      {
        id: "c-5",
        first_name: "DuplicatePhone",
        last_name: "User",
        mobile_phone: "+91 97527 88803", // Duplicate of c-1
      },
      {
        id: "c-6",
        first_name: "InvalidPhone",
        last_name: "User",
        mobile_phone: "unavailable",
      },
    ];

    it("Test Case 1: Select one Contact -> processes single valid contact", () => {
      const result = processContactsForWhatsApp([mockContacts[0]]);
      expect(result.validRecipients).toHaveLength(1);
      expect(result.validRecipients[0].name).toBe("Rahul Sharma");
      expect(result.validRecipients[0].cleanPhone).toBe("919752788803");
      expect(result.skippedContacts).toHaveLength(0);
      expect(result.uniquePhoneNumbers).toEqual(["919752788803"]);
      expect(result.extPhoneParam).toBe("919752788803");
    });

    it("Test Case 2: Select multiple Contacts -> collects valid phone numbers", () => {
      const result = processContactsForWhatsApp([
        mockContacts[0],
        mockContacts[1],
        mockContacts[2],
      ]);
      expect(result.validRecipients).toHaveLength(3);
      expect(result.skippedContacts).toHaveLength(0);
      expect(result.uniquePhoneNumbers).toEqual([
        "919752788803",
        "919876543210",
        "919999999999",
      ]);
      expect(result.extPhoneParam).toBe(
        "919752788803,919876543210,919999999999"
      );
    });

    it("Test Case 5: Skips contacts without valid phone numbers and reports skipped count", () => {
      // 5 selected, 3 valid, 2 invalid/missing
      const selected = [
        mockContacts[0], // valid 919752788803
        mockContacts[1], // valid 919876543210
        mockContacts[2], // valid 919999999999
        mockContacts[3], // missing phone
        mockContacts[5], // unavailable
      ];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(3);
      expect(result.skippedContacts).toHaveLength(2);
      expect(result.skippedContacts.map((s) => s.name)).toEqual([
        "NoPhone User",
        "InvalidPhone User",
      ]);
      expect(result.uniquePhoneNumbers).toEqual([
        "919752788803",
        "919876543210",
        "919999999999",
      ]);
    });

    it("Test Case 6: Multiple contacts with duplicate numbers are deduplicated", () => {
      const selected = [
        mockContacts[0], // 919752788803
        mockContacts[4], // 919752788803 (duplicate)
        mockContacts[1], // 919876543210
      ];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(3); // 3 recipient items
      expect(result.uniquePhoneNumbers).toHaveLength(2); // 2 unique numbers
      expect(result.uniquePhoneNumbers).toEqual(["919752788803", "919876543210"]);
      expect(result.extPhoneParam).toBe("919752788803,919876543210");
    });

    it("Handles zero valid phone numbers case", () => {
      const selected = [mockContacts[3], mockContacts[5]];
      const result = processContactsForWhatsApp(selected);
      expect(result.validRecipients).toHaveLength(0);
      expect(result.skippedContacts).toHaveLength(2);
      expect(result.uniquePhoneNumbers).toHaveLength(0);
      expect(result.extPhoneParam).toBe("");
    });
  });

  describe("URL Construction & Encoding Safety", () => {
    it("Test Case 7: Message containing spaces", () => {
      const url = buildWhatsAppWebExtensionUrl(
        "919752788803,919876543210",
        "Hello Ji"
      );
      expect(url).toBe(
        "https://web.whatsapp.com/?ext_phone=919752788803,919876543210&ext_msg=Hello%20Ji&ext_send=true"
      );
      expect(url).toContain("ext_phone=919752788803,919876543210");
      expect(url).toContain("ext_msg=Hello%20Ji");
      expect(url).toContain("ext_send=true");
    });

    it("Test Case 8: Message containing emojis", () => {
      const url = buildWhatsAppWebExtensionUrl(
        ["919752788803"],
        "Hello 👋 how are you? 🚀"
      );
      expect(url).toBe(
        `https://web.whatsapp.com/?ext_phone=919752788803&ext_msg=${encodeURIComponent("Hello 👋 how are you? 🚀")}&ext_send=true`
      );
      // Decoded URL parameters match original
      const parsedUrl = new URL(url);
      expect(parsedUrl.searchParams.get("ext_phone")).toBe("919752788803");
      expect(parsedUrl.searchParams.get("ext_msg")).toBe("Hello 👋 how are you? 🚀");
      expect(parsedUrl.searchParams.get("ext_send")).toBe("true");
    });

    it("Test Case 9: Message containing &, ?, #, %, / and other special characters", () => {
      const specialMessage =
        "Special chars test: & ampersand, ? question, # hash, % percent, / slash, = equals, + plus, ' quote, \" double quote";
      const url = buildWhatsAppWebExtensionUrl(
        ["919752788803", "919876543210"],
        specialMessage
      );

      expect(url).toBe(
        `https://web.whatsapp.com/?ext_phone=919752788803,919876543210&ext_msg=${encodeURIComponent(specialMessage)}&ext_send=true`
      );

      // Verify safe round-trip parsing
      const parsedUrl = new URL(url);
      expect(parsedUrl.searchParams.get("ext_phone")).toBe("919752788803,919876543210");
      expect(parsedUrl.searchParams.get("ext_msg")).toBe(specialMessage);
      expect(parsedUrl.searchParams.get("ext_send")).toBe("true");
    });

    it("Matches Section 15 final UX example URL exactly", () => {
      const numbers = ["919752788803", "919876543210", "919999999999"];
      const message = "Hello, I wanted to connect with you.";
      const url = buildWhatsAppWebExtensionUrl(numbers, message);

      expect(url).toBe(
        "https://web.whatsapp.com/?ext_phone=919752788803,919876543210,919999999999&ext_msg=Hello%2C%20I%20wanted%20to%20connect%20with%20you.&ext_send=true"
      );
    });

    it("Accepts phone numbers as comma-separated string or array of strings", () => {
      const urlFromArray = buildWhatsAppWebExtensionUrl(
        ["919752788803", "919876543210"],
        "Test"
      );
      const urlFromString = buildWhatsAppWebExtensionUrl(
        "919752788803,919876543210",
        "Test"
      );
      expect(urlFromArray).toBe(urlFromString);
    });
  });
});
