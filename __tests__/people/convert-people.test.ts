import {
  convertPeopleToContacts,
  convertPeopleToLeads,
} from "@/actions/crm/people/convert-people";
import type { PeopleRecord } from "@/types/people";

// Mock dependencies
jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "test-user-123", email: "admin@example.com", name: "Admin User" },
  }),
}));

const mockCreatedContacts: any[] = [];
const mockCreatedLeads: any[] = [];

jest.mock("@/lib/prisma", () => ({
  withPrismaRetry: jest.fn((fn) => (typeof fn === "function" ? fn() : fn)),
  prismadb: {
    crm_Contacts: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const isDupeEmail =
          where?.email?.equals === "existing@example.com" ||
          where?.OR?.some(
            (cond: any) =>
              cond?.email?.equals === "existing@example.com" ||
              cond?.personal_email?.equals === "existing@example.com"
          );
        if (isDupeEmail) {
          return Promise.resolve({ id: "contact-existing-1", first_name: "Existing", last_name: "Contact" });
        }

        const isDupePhone =
          where?.phone?.equals === "+15550009999" ||
          where?.OR?.some((cond: any) => cond?.phone?.equals === "+15550009999");
        if (isDupePhone) {
          return Promise.resolve({ id: "contact-existing-2", first_name: "PhoneDupe", last_name: "User" });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newContact = { id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, ...data };
        mockCreatedContacts.push(newContact);
        return Promise.resolve(newContact);
      }),
    },
    crm_Leads: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const isDupeLeadEmail =
          where?.email?.equals === "lead.existing@example.com" ||
          where?.OR?.some(
            (cond: any) =>
              cond?.email?.equals === "lead.existing@example.com" ||
              cond?.personal_email?.equals === "lead.existing@example.com"
          );
        if (isDupeLeadEmail) {
          return Promise.resolve({ id: "lead-existing-1", firstName: "Existing", lastName: "Lead" });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newLead = { id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, ...data };
        mockCreatedLeads.push(newLead);
        return Promise.resolve(newLead);
      }),
    },
    crm_Accounts: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where?.id === "valid-account-uuid-123") {
          return Promise.resolve({ id: "valid-account-uuid-123", name: "Existing Corp" });
        }
        if (where?.name?.equals === "Existing Corp") {
          return Promise.resolve({ id: "valid-account-uuid-123", name: "Existing Corp" });
        }
        return Promise.resolve(null);
      }),
    },
    crm_Opportunities: {
      create: jest.fn().mockResolvedValue({ id: "opp-123" }),
    },
    crm_Opportunities_Sales_Stages: {
      findMany: jest.fn().mockResolvedValue([
        { id: "stage-1", name: "New Lead Intake", probability: 0, order: 0 },
      ]),
      findFirst: jest.fn().mockResolvedValue({ id: "stage-1", name: "New Lead Intake", probability: 0, order: 0 }),
      create: jest.fn().mockResolvedValue({ id: "stage-1", name: "New Lead Intake" }),
    },
    users: {
      findMany: jest.fn().mockResolvedValue([{ id: "test-user-123" }]),
      findFirst: jest.fn().mockResolvedValue({ id: "test-user-123" }),
      findUnique: jest.fn().mockResolvedValue({ id: "test-user-123" }),
    },
  },
}));

jest.mock("@/lib/audit-log", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("People - Convert to Contact and Convert to Lead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatedContacts.length = 0;
    mockCreatedLeads.length = 0;
  });

  const sampleContactRecord: PeopleRecord = {
    id: "con-101",
    originalId: "ext-101",
    type: "Contact",
    name: "Rahul Sharma",
    fullName: "Rahul Sharma",
    firstName: "Rahul",
    lastName: "Sharma",
    company: "Acme Corp",
    jobTitle: "CTO",
    email: "rahul.sharma@example.com",
    phone: "+1 555-0101",
    address: "123 Tech Blvd",
    city: "San Francisco",
    state: "CA",
    country: "United States",
    postalCode: "94105",
    raw: {},
  };

  const duplicateContactRecord: PeopleRecord = {
    id: "con-102",
    originalId: "ext-102",
    type: "Contact",
    name: "Existing Contact",
    fullName: "Existing Contact",
    email: "existing@example.com",
    raw: {},
  };

  const bareAccountRecord: PeopleRecord = {
    id: "acc-201",
    originalId: "ext-201",
    type: "Account",
    name: "ABC Ltd",
    fullName: "ABC Ltd",
    company: "ABC Ltd",
    jobTitle: "Company / Organization",
    email: "",
    phone: "",
    raw: {},
  };

  const accountWithContactRecord: PeopleRecord = {
    id: "acc-202",
    originalId: "ext-202",
    type: "Account",
    name: "Amit Patel",
    fullName: "Amit Patel",
    company: "Patel Enterprise",
    email: "amit.patel@patel.com",
    phone: "+1 555-0202",
    raw: {},
  };

  const recordWithProblematicAccountId: PeopleRecord = {
    id: "con-54a110e969702d196d0f0000",
    originalId: "54a110e969702d196d0f0000",
    type: "Contact",
    name: "John Doe",
    fullName: "John Doe",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@unknowncorp.com",
    company: "Unknown External Corp",
    accountsIDs: "['5b1cea77a3ae611f68d96fec']", // Problematic stringified array format from external API
    raw: {
      accountsIDs: "['5b1cea77a3ae611f68d96fec']",
    },
  };

  const recordWithValidAccountName: PeopleRecord = {
    id: "con-303",
    originalId: "ext-303",
    type: "Contact",
    name: "Jane Smith",
    fullName: "Jane Smith",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@existing.com",
    company: "Existing Corp",
    accountsIDs: "",
    raw: {},
  };

  describe("convertPeopleToContacts", () => {
    it("converts eligible People records into Contacts", async () => {
      const result = await convertPeopleToContacts([sampleContactRecord, accountWithContactRecord]);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.convertedCount).toBe(2);
      expect(result.alreadyExistsCount).toBe(0);
      expect(result.failedCount).toBe(0);

      const rahulResult = result.results.find((r) => r.id === "con-101");
      expect(rahulResult?.status).toBe("converted");
      expect(rahulResult?.targetType).toBe("Contact");
    });

    it("safely handles external/unmatched Account IDs without violating foreign key constraints", async () => {
      const result = await convertPeopleToContacts([recordWithProblematicAccountId]);

      expect(result.success).toBe(true);
      expect(result.convertedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const created = mockCreatedContacts.find((c) => c.email === "john.doe@unknowncorp.com");
      expect(created).toBeDefined();
      expect(created.company).toBe("Unknown External Corp");
      // Foreign key field must NOT contain invalid external ID string
      expect(created.accountsIDs).toBeUndefined();
    });

    it("links to matching internal Account when company name or ID exists in database", async () => {
      const result = await convertPeopleToContacts([recordWithValidAccountName]);

      expect(result.success).toBe(true);
      expect(result.convertedCount).toBe(1);

      const created = mockCreatedContacts.find((c) => c.email === "jane.smith@existing.com");
      expect(created).toBeDefined();
      expect(created.accountsIDs).toBe("valid-account-uuid-123");
    });

    it("detects existing Contacts and avoids duplicate creation", async () => {
      const result = await convertPeopleToContacts([sampleContactRecord, duplicateContactRecord]);

      expect(result.total).toBe(2);
      expect(result.convertedCount).toBe(1);
      expect(result.alreadyExistsCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const dupeResult = result.results.find((r) => r.id === "con-102");
      expect(dupeResult?.status).toBe("already_exists");
      expect(dupeResult?.message).toContain("already exists as a Contact");
    });

    it("rejects bare Account records missing contact/person information", async () => {
      const result = await convertPeopleToContacts([bareAccountRecord]);

      expect(result.total).toBe(1);
      expect(result.convertedCount).toBe(0);
      expect(result.failedCount).toBe(1);

      const failedResult = result.results[0];
      expect(failedResult.status).toBe("failed");
      expect(failedResult.message).toContain("ABC Ltd cannot be converted because no valid contact/person information is available");
    });
  });

  describe("convertPeopleToLeads", () => {
    it("converts eligible People records into Leads and creates pipeline opportunity", async () => {
      const result = await convertPeopleToLeads([sampleContactRecord, accountWithContactRecord]);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.convertedCount).toBe(2);
      expect(result.alreadyExistsCount).toBe(0);
      expect(result.failedCount).toBe(0);

      const firstLead = result.results[0];
      expect(firstLead.status).toBe("converted");
      expect(firstLead.targetType).toBe("Lead");
    });

    it("safely handles external/unmatched Account IDs for Leads without violating foreign key constraints", async () => {
      const result = await convertPeopleToLeads([recordWithProblematicAccountId]);

      expect(result.success).toBe(true);
      expect(result.convertedCount).toBe(1);

      const created = mockCreatedLeads.find((l) => l.email === "john.doe@unknowncorp.com");
      expect(created).toBeDefined();
      expect(created.company).toBe("Unknown External Corp");
      expect(created.accountsIDs).toBeUndefined();
    });

    it("detects existing Leads and avoids duplicate creation", async () => {
      const existingLeadRecord: PeopleRecord = {
        id: "con-103",
        originalId: "ext-103",
        type: "Contact",
        name: "Existing Lead",
        fullName: "Existing Lead",
        email: "lead.existing@example.com",
        raw: {},
      };

      const result = await convertPeopleToLeads([existingLeadRecord]);

      expect(result.total).toBe(1);
      expect(result.convertedCount).toBe(0);
      expect(result.alreadyExistsCount).toBe(1);

      expect(result.results[0].status).toBe("already_exists");
      expect(result.results[0].message).toContain("already exists as a Lead");
    });
  });
});
