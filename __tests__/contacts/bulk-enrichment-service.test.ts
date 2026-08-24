jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Contacts: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/api-keys", () => ({
  getApiKey: jest.fn().mockResolvedValue(null),
  getAllApiKeys: jest.fn().mockResolvedValue([]),
  sanitizeApiKey: jest.fn((k) => k || null),
  maskApiKey: jest.fn((k) => k || "[none]"),
  isPlaceholderKey: jest.fn(() => false),
}));

import { prismadb } from "@/lib/prisma";
import {
  isValidString,
  parseEmailInfo,
  buildContactUpdateData,
  bulkEnrichContacts,
  EnrichedContactData,
} from "@/lib/contacts/bulk-enrichment-service";
import type { crm_Contacts } from "@prisma/client";

describe("Bulk Contact Enrichment Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isValidString", () => {
    it("returns true for valid strings", () => {
      expect(isValidString("hello")).toBe(true);
      expect(isValidString("  valid string  ")).toBe(true);
      expect(isValidString("0")).toBe(true);
    });

    it("returns false for empty or invalid strings", () => {
      expect(isValidString("")).toBe(false);
      expect(isValidString("   ")).toBe(false);
      expect(isValidString(null)).toBe(false);
      expect(isValidString(undefined)).toBe(false);
      expect(isValidString(123)).toBe(false);
      expect(isValidString("null")).toBe(false);
      expect(isValidString("undefined")).toBe(false);
      expect(isValidString("N/A")).toBe(false);
      expect(isValidString("none")).toBe(false);
      expect(isValidString("unknown")).toBe(false);
    });
  });

  describe("parseEmailInfo", () => {
    it("correctly parses corporate emails", () => {
      const res = parseEmailInfo("john.doe@acmecorp.com");
      expect(res.domain).toBe("acmecorp.com");
      expect(res.companyGuess).toBe("Acmecorp");
      expect(res.isPersonal).toBe(false);
      expect(res.firstNameGuess).toBe("John");
      expect(res.lastNameGuess).toBe("Doe");
    });

    it("correctly detects personal email domains", () => {
      const res = parseEmailInfo("sarah.connor@gmail.com");
      expect(res.domain).toBe("gmail.com");
      expect(res.isPersonal).toBe(true);
      expect(res.companyGuess).toBeNull();
      expect(res.firstNameGuess).toBe("Sarah");
      expect(res.lastNameGuess).toBe("Connor");
    });

    it("handles invalid email inputs", () => {
      const res = parseEmailInfo("");
      expect(res.domain).toBeNull();
      expect(res.firstNameGuess).toBeNull();
    });
  });

  describe("buildContactUpdateData", () => {
    const baseContact = {
      id: "contact-123",
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@example.com",
      personal_email: null,
      phone: null,
      mobile_phone: null,
      office_phone: null,
      jobTitle: null,
      position: null,
      company: null,
      website: null,
      social_linkedin: null,
      social_twitter: null,
      social_facebook: null,
      social_instagram: null,
      description: null,
      address: null,
      address_line1: null,
      city: null,
      state: null,
      country: null,
      postal_code: null,
      custom_fields_data: null,
    } as unknown as crm_Contacts;

    it("fills empty fields with enriched valid data", () => {
      const enriched: EnrichedContactData = {
        company_name: "Tech Giants Inc",
        company_website: "https://techgiants.com",
        job_title: "Head of Engineering",
        linkedin_url: "https://linkedin.com/in/alicesmith",
        phone: "+1 555 123 4567",
        city: "San Francisco",
        state: "CA",
        country: "USA",
        industry: "Software",
        company_size: "50-200",
      };

      const { updateData, updatedFieldNames } = buildContactUpdateData(
        baseContact,
        enriched
      );

      expect(updateData.company).toBe("Tech Giants Inc");
      expect(updateData.website).toBe("https://techgiants.com");
      expect(updateData.jobTitle).toBe("Head of Engineering");
      expect(updateData.social_linkedin).toBe("https://linkedin.com/in/alicesmith");
      expect(updateData.phone).toBe("+1 555 123 4567");
      expect(updateData.city).toBe("San Francisco");
      expect(updateData.state).toBe("CA");
      expect(updateData.country).toBe("USA");
      expect(updateData.custom_fields_data).toEqual({
        industry: "Software",
        company_size: "50-200",
      });
      expect(updatedFieldNames).toContain("company");
      expect(updatedFieldNames).toContain("jobTitle");
      expect(updatedFieldNames).toContain("social_linkedin");
      expect(updatedFieldNames).toContain("industry");
    });

    it("never overwrites existing non-empty fields with null or empty values", () => {
      const existingContact = {
        ...baseContact,
        company: "Existing Company",
        website: "https://existing.com",
        phone: "123456",
      } as unknown as crm_Contacts;

      const enriched: EnrichedContactData = {
        company_name: null,
        company_website: "",
        phone: "   ",
        job_title: "New Title",
      };

      const { updateData } = buildContactUpdateData(
        existingContact,
        enriched
      );

      expect(updateData.company).toBeUndefined();
      expect(updateData.website).toBeUndefined();
      expect(updateData.phone).toBeUndefined();
      expect(updateData.jobTitle).toBe("New Title");
    });

    it("preserves existing custom_fields_data when adding new custom fields", () => {
      const existingContact = {
        ...baseContact,
        custom_fields_data: {
          existing_key: "existing_val",
        },
      } as unknown as crm_Contacts;

      const enriched: EnrichedContactData = {
        industry: "Finance",
        company_size: "1000+",
      };

      const { updateData } = buildContactUpdateData(
        existingContact,
        enriched
      );

      expect(updateData.custom_fields_data).toEqual({
        existing_key: "existing_val",
        industry: "Finance",
        company_size: "1000+",
      });
    });
  });

  describe("bulkEnrichContacts", () => {
    it("returns empty result when contactIds array is empty", async () => {
      const res = await bulkEnrichContacts([]);
      expect(res.total).toBe(0);
      expect(res.successCount).toBe(0);
      expect(res.updatedContacts).toEqual([]);
      expect(res.failedContacts).toEqual([]);
    });

    it("enriches selected contacts and updates existing records by ID without duplicates", async () => {
      const mockContact1 = {
        id: "c-1",
        first_name: null,
        last_name: "Doe",
        email: "john.doe@acme.com",
        company: null,
        website: null,
        jobTitle: null,
        custom_fields_data: null,
      };

      const mockContact2 = {
        id: "c-2",
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@stripe.com",
        company: "Stripe",
        website: "https://stripe.com",
        jobTitle: "Staff Engineer",
        custom_fields_data: null,
      };

      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([
        mockContact1,
        mockContact2,
      ]);

      (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(({ where, data }) => ({
        ...mockContact1,
        ...data,
        id: where.id,
      }));

      const res = await bulkEnrichContacts(["c-1", "c-2"], "user-1");

      expect(prismadb.crm_Contacts.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["c-1", "c-2"] },
          deletedAt: null,
        },
        select: expect.any(Object),
      });

      expect(res.success).toBe(true);
      expect(res.total).toBe(2);
      expect(res.successCount).toBe(2);
      expect(res.failedCount).toBe(0);
      expect(res.updatedContacts.length).toBe(2);
    });

    it("handles partial failures gracefully when some contacts are missing or invalid", async () => {
      const validContact = {
        id: "c-valid",
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@test.com",
      };

      const emptyContact = {
        id: "c-empty",
        first_name: null,
        last_name: "",
        email: null,
        personal_email: null,
        company: null,
        website: null,
      };

      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([
        validContact,
        emptyContact,
      ]);

      (prismadb.crm_Contacts.update as jest.Mock).mockResolvedValue({
        ...validContact,
      });

      const res = await bulkEnrichContacts(["c-valid", "c-empty", "c-nonexistent"]);

      expect(res.total).toBe(3);
      expect(res.successCount).toBe(1);
      expect(res.failedCount).toBe(2);
      expect(res.failedContacts).toEqual([
        expect.objectContaining({ id: "c-empty" }),
        expect.objectContaining({ id: "c-nonexistent" }),
      ]);
    });
  });
});
