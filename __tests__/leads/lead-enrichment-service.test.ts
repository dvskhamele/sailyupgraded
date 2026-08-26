jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Leads: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    crm_Accounts: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crm_Contacts: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
  buildLeadUpdateData,
  bulkEnrichLeads,
  updateLeadFromEnrichment,
} from "@/lib/leads/lead-enrichment-service";
import {
  isValidString,
  EnrichedPersonData,
  EnrichedDataResult,
} from "@/lib/enrichment/external-enrichment-service";
import type { crm_Leads } from "@prisma/client";

describe("Lead Enrichment Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("buildLeadUpdateData", () => {
    const baseLead = {
      id: "lead-123",
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@example.com",
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
      social_skype: null,
      social_youtube: null,
      social_tiktok: null,
      description: null,
      address: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      country: null,
      postal_code: null,
      accountsIDs: null,
      custom_fields_data: null,
    } as unknown as crm_Leads;

    it("fills empty fields with enriched valid data", () => {
      const enriched: EnrichedPersonData = {
        company_name: "ABC Technologies",
        company_website: "https://abctech.com",
        job_title: "Chief Architect",
        linkedin_url: "https://linkedin.com/in/rahulsharma",
        phone: "+91 9876543210",
        city: "Bangalore",
        state: "Karnataka",
        country: "India",
        postal_code: "560001",
        industry: "Information Technology",
        company_size: "500-1000",
      };

      const { updateData, updatedFieldNames } = buildLeadUpdateData(
        baseLead,
        enriched,
        "acc-123"
      );

      expect(updateData.company).toBe("ABC Technologies");
      expect(updateData.website).toBe("https://abctech.com");
      expect(updateData.jobTitle).toBe("Chief Architect");
      expect(updateData.social_linkedin).toBe("https://linkedin.com/in/rahulsharma");
      expect(updateData.phone).toBe("+91 9876543210");
      expect(updateData.city).toBe("Bangalore");
      expect(updateData.state).toBe("Karnataka");
      expect(updateData.country).toBe("India");
      expect(updateData.postal_code).toBe("560001");
      expect(updateData.accountsIDs).toBe("acc-123");
      expect(updateData.custom_fields_data).toEqual({
        industry: "Information Technology",
        company_size: "500-1000",
      });
      expect(updatedFieldNames).toContain("company");
      expect(updatedFieldNames).toContain("jobTitle");
      expect(updatedFieldNames).toContain("social_linkedin");
      expect(updatedFieldNames).toContain("accountsIDs");
      expect(updatedFieldNames).toContain("industry");
    });

    it("never overwrites existing non-empty Lead fields with null or empty values", () => {
      const existingLead = {
        ...baseLead,
        company: "Existing Inc",
        website: "https://existing.com",
        phone: "+91 9999999999",
      } as unknown as crm_Leads;

      const enriched: EnrichedPersonData = {
        company_name: "Different Company",
        company_website: "https://different.com",
        phone: "+91 8888888888",
        job_title: "Lead Developer",
      };

      const { updateData } = buildLeadUpdateData(
        existingLead,
        enriched
      );

      // Existing phone, company, and website must be preserved
      expect(updateData.company).toBeUndefined();
      expect(updateData.website).toBeUndefined();
      expect(updateData.phone).toBeUndefined();
      // Empty jobTitle was updated
      expect(updateData.jobTitle).toBe("Lead Developer");
    });

    it("preserves existing custom_fields_data when adding new custom fields", () => {
      const existingLead = {
        ...baseLead,
        custom_fields_data: {
          existing_tag: "lead_source_web",
        },
      } as unknown as crm_Leads;

      const enriched: EnrichedPersonData = {
        industry: "Fintech",
        company_size: "100-250",
      };

      const { updateData } = buildLeadUpdateData(
        existingLead,
        enriched
      );

      expect(updateData.custom_fields_data).toEqual({
        existing_tag: "lead_source_web",
        industry: "Fintech",
        company_size: "100-250",
      });
    });
  });

  describe("bulkEnrichLeads and entity independence", () => {
    it("returns empty result when leadIds array is empty", async () => {
      const res = await bulkEnrichLeads([]);
      expect(res.total).toBe(0);
      expect(res.successCount).toBe(0);
      expect(res.updatedLeads).toEqual([]);
      expect(res.failedLeads).toEqual([]);
    });

    it("enriches selected leads and updates ONLY crm_Leads, NEVER crm_Contacts", async () => {
      const mockLead1 = {
        id: "l-1",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice.smith@innovate.com",
        company: null,
        website: null,
        phone: null,
        jobTitle: null,
        accountsIDs: null,
        deletedAt: null,
      };

      (prismadb.crm_Leads.findMany as jest.Mock).mockResolvedValue([mockLead1]);
      (prismadb.crm_Leads.findUnique as jest.Mock).mockResolvedValue(mockLead1);
      (prismadb.crm_Accounts.findFirst as jest.Mock).mockResolvedValue(null);
      (prismadb.crm_Accounts.create as jest.Mock).mockResolvedValue({
        id: "acc-new",
        name: "Innovate",
      });
      (prismadb.crm_Leads.update as jest.Mock).mockImplementation(({ where, data }) => ({
        ...mockLead1,
        ...data,
        id: where.id,
      }));

      const res = await bulkEnrichLeads(["l-1"], "user-1");

      expect(prismadb.crm_Leads.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["l-1"] },
          deletedAt: null,
        },
        include: {
          assigned_accounts: true,
        },
      });

      // Lead update must be called
      expect(prismadb.crm_Leads.update).toHaveBeenCalled();

      // CRITICAL ARCHITECTURE RULE: crm_Contacts must NEVER be called
      expect(prismadb.crm_Contacts.findMany).not.toHaveBeenCalled();
      expect(prismadb.crm_Contacts.findUnique).not.toHaveBeenCalled();
      expect(prismadb.crm_Contacts.update).not.toHaveBeenCalled();

      expect(res.success).toBe(true);
      expect(res.total).toBe(1);
      expect(res.successCount).toBe(1);
      expect(res.failedCount).toBe(0);
    });

    it("handles partial failures gracefully when some leads are missing or invalid", async () => {
      const validLead = {
        id: "l-valid",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@testcompany.com",
        deletedAt: null,
      };

      const emptyLead = {
        id: "l-empty",
        firstName: "",
        lastName: null,
        email: null,
        personal_email: null,
        phone: null,
        company: null,
        website: null,
        deletedAt: null,
      };

      (prismadb.crm_Leads.findMany as jest.Mock).mockResolvedValue([
        validLead,
        emptyLead,
      ]);
      (prismadb.crm_Leads.findUnique as jest.Mock).mockResolvedValue(validLead);
      (prismadb.crm_Accounts.findFirst as jest.Mock).mockResolvedValue(null);
      (prismadb.crm_Leads.update as jest.Mock).mockResolvedValue(validLead);

      const res = await bulkEnrichLeads(["l-valid", "l-empty", "l-nonexistent"]);

      expect(res.total).toBe(3);
      expect(res.successCount).toBe(1);
      expect(res.failedCount).toBe(2);
      expect(res.failedLeads).toEqual([
        expect.objectContaining({ id: "l-empty" }),
        expect.objectContaining({ id: "l-nonexistent" }),
      ]);
    });
  });
});
