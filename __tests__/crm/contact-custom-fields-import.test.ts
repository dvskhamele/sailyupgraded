jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Contacts: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crm_Accounts: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    users: {
      findMany: jest.fn(),
    },
    crm_Lead_Sources: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    crm_Lead_Statuses: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    crm_Lead_Types: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    crm_Contact_Types: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    custom_fields: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

import {
  normalizeHeader,
  fieldAppliesToEntity,
  filterCustomFieldsForEntity,
  sanitizeCustomFieldValues,
  mergeCustomFieldValues,
  type CustomFieldDefinition,
} from "@/lib/custom-fields";
import {
  buildFieldMapping,
  mapRow,
  extractCustomFields,
} from "@/lib/crm/contact-importer";

describe("Custom Fields Normalization and Header Resolution", () => {
  it("normalizes headers with mixed case, spaces, underscores, and special characters", () => {
    expect(normalizeHeader("Customer Type")).toBe("customertype");
    expect(normalizeHeader("customer_type")).toBe("customertype");
    expect(normalizeHeader("Customer-Type")).toBe("customertype");
    expect(normalizeHeader("CUSTOMER TYPE ")).toBe("customertype");
    expect(normalizeHeader("Custom Field 1")).toBe("customfield1");
    expect(normalizeHeader("BIRTH DATE")).toBe("birthdate");
  });

  it("applies role scoping correctly for contact roles", () => {
    const customFields: CustomFieldDefinition[] = [
      { id: "cf-cust", name: "VIP Tier", type: "select", applies_to: ["Contact:Customer"], options: ["Gold", "Silver"] },
      { id: "cf-agent", name: "Agent Code", type: "text", applies_to: ["Contact:Agent"] },
      { id: "cf-all", name: "Global Tag", type: "text", applies_to: ["Contact"] },
    ];

    const customerFields = filterCustomFieldsForEntity(customFields, "Contact", "Customer");
    expect(customerFields.map((f) => f.id)).toEqual(["cf-cust", "cf-all"]);

    const agentFields = filterCustomFieldsForEntity(customFields, "Contact", "Agent");
    expect(agentFields.map((f) => f.id)).toEqual(["cf-agent", "cf-all"]);

    const allContactFields = filterCustomFieldsForEntity(customFields, "Contact", null);
    expect(allContactFields.map((f) => f.id)).toEqual(["cf-cust", "cf-agent", "cf-all"]);
  });
});

describe("Custom Fields Value Sanitization", () => {
  const customFields: CustomFieldDefinition[] = [
    { id: "cf-text", name: "Custom Text", type: "text", applies_to: ["Contact"] },
    { id: "cf-num", name: "Deal Amount", type: "number", applies_to: ["Contact"] },
    { id: "cf-select", name: "Customer Tier", type: "select", applies_to: ["Contact"], options: ["Starter", "Professional", "Enterprise"] },
    { id: "cf-bool", name: "Is VIP", type: "boolean", applies_to: ["Contact"] },
    { id: "cf-date", name: "Onboarding Date", type: "date", applies_to: ["Contact"] },
  ];

  it("resolves values matching by field ID, prefixed key, display name, and case-insensitive headers", () => {
    const rawValues = {
      "cf-text": "Value 1",
      "Deal Amount": "$1,500.75",
      "customer tier": "professional",
      "Is VIP": "yes",
      "onboarding_date": "2026-05-01",
    };

    const sanitized = sanitizeCustomFieldValues(rawValues, customFields);

    expect(sanitized).toEqual({
      "cf-text": "Value 1",
      "cf-num": "1500.75",
      "cf-select": "Professional", // Canonical casing from options
      "cf-bool": "true",
      "cf-date": "2026-05-01",
    });
  });

  it("handles empty and whitespace values by omitting them", () => {
    const rawValues = {
      "cf-text": "   ",
      "cf-num": "",
      "cf-select": "",
    };

    const sanitized = sanitizeCustomFieldValues(rawValues, customFields);
    expect(sanitized).toEqual({});
  });
});

describe("Custom Fields Merging for Record Updates", () => {
  it("merges incoming custom fields into existing custom fields without deleting existing ones", () => {
    const existing = {
      "cf-plan": "Starter",
      "cf-source": "Referral",
      "cf-rating": "5",
    };

    const incoming = {
      "cf-plan": "Enterprise", // updated
      "cf-notes": "Upgraded recently", // added
    };

    const merged = mergeCustomFieldValues(existing, incoming);

    expect(merged).toEqual({
      "cf-plan": "Enterprise",
      "cf-source": "Referral", // preserved
      "cf-rating": "5", // preserved
      "cf-notes": "Upgraded recently",
    });
  });

  it("does not overwrite existing custom field values when incoming value is empty or undefined", () => {
    const existing = {
      "cf-plan": "Starter",
      "cf-source": "Referral",
    };

    const incoming = {
      "cf-plan": "", // empty cell in excel
      "cf-source": null,
      "cf-notes": "New note",
    };

    const merged = mergeCustomFieldValues(existing, incoming);

    expect(merged).toEqual({
      "cf-plan": "Starter", // preserved
      "cf-source": "Referral", // preserved
      "cf-notes": "New note",
    });
  });
});

describe("Contact Importer Field Mapping and Row Processing", () => {
  const customFields: CustomFieldDefinition[] = [
    { id: "cf-industry", name: "Industry Sector", type: "text", applies_to: ["Contact"] },
    { id: "cf-score", name: "Lead Score", type: "number", applies_to: ["Contact"] },
    { id: "cf-plan", name: "Plan Type", type: "select", applies_to: ["Contact"], options: ["Basic", "Premium"] },
  ];

  it("correctly builds field mapping for normal and custom fields", () => {
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Mobile Phone",
      "Company",
      "Industry Sector",
      "lead_score",
      "PLAN TYPE",
      "Random Unmapped Column",
    ];

    const mapping = buildFieldMapping(headers, customFields, "Customer");

    expect(mapping.modelFields).toEqual({
      "First Name": "first_name",
      "Last Name": "last_name",
      Email: "email",
      "Mobile Phone": "mobile_phone",
      Company: "company",
    });

    expect(mapping.customFields).toEqual({
      "Industry Sector": "cf-industry",
      lead_score: "cf-score",
      "PLAN TYPE": "cf-plan",
    });

    expect(mapping.unknownHeaders).toEqual(["Random Unmapped Column"]);
  });

  it("maps rows and extracts custom fields accurately into UUID keys", () => {
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Industry Sector",
      "lead_score",
      "PLAN TYPE",
    ];
    const mapping = buildFieldMapping(headers, customFields, "Customer");

    const row = {
      "First Name": "John",
      "Last Name": "Doe",
      Email: "john@example.com",
      "Industry Sector": "FinTech",
      lead_score: "95",
      "PLAN TYPE": "premium",
    };

    const mapped = mapRow(row, mapping);
    const extracted = extractCustomFields(mapped, customFields);
    const sanitized = sanitizeCustomFieldValues(extracted, customFields);

    expect(mapped.modelValues).toEqual({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
    });

    expect(sanitized).toEqual({
      "cf-industry": "FinTech",
      "cf-score": "95",
      "cf-plan": "Premium", // correctly matched to canonical option
    });
  });
});

describe("End-to-End importContacts with Custom Fields and Existing Records", () => {
  const customFields: CustomFieldDefinition[] = [
    { id: "cf-type", name: "Customer Type", type: "select", applies_to: ["Contact"], options: ["VIP", "Standard", "Enterprise"] },
    { id: "cf-budget", name: "Annual Budget", type: "number", applies_to: ["Contact"] },
    { id: "cf-dept", name: "Department Name", type: "text", applies_to: ["Contact"] },
  ];

  it("imports new contacts and updates existing contacts with merged custom_fields_data", async () => {
    const { prismadb } = require("@/lib/prisma");
    const { importContacts } = require("@/lib/crm/contact-importer");

    // Mock existing contacts
    const existingContact1 = {
      id: "cont-existing-1",
      serial: "CUST-001",
      email: "existing1@example.com",
      personal_email: null,
      mobile_phone: "+1234567890",
      office_phone: null,
      custom_fields_data: {
        "cf-type": "Standard",
        "cf-budget": "50000",
        "cf-legacy": "Legacy Note",
      },
    };

    const existingContact2 = {
      id: "cont-existing-2",
      serial: "CUST-002",
      email: "existing2@example.com",
      personal_email: null,
      mobile_phone: "+1987654321",
      office_phone: null,
      custom_fields_data: {
        "cf-type": "VIP",
      },
    };

    const createdRecords: any[] = [];
    const updatedRecords: any[] = [];

    // Mock Prisma methods
    jest.spyOn(prismadb.crm_Contacts, "findMany").mockResolvedValue([existingContact1, existingContact2] as any);
    jest.spyOn(prismadb.crm_Contacts, "create").mockImplementation(async ({ data }: any) => {
      const created = { id: `cont-new-${createdRecords.length + 1}`, ...data };
      createdRecords.push(created);
      return created as any;
    });
    jest.spyOn(prismadb.crm_Contacts, "update").mockImplementation(async ({ where, data }: any) => {
      const updated = { id: where.id, ...data };
      updatedRecords.push(updated);
      return updated as any;
    });
    jest.spyOn(prismadb.crm_Accounts, "findMany").mockResolvedValue([] as any);
    jest.spyOn(prismadb.crm_Accounts, "create").mockImplementation(async ({ data }: any) => ({ id: "acc-1", name: data.name } as any));
    jest.spyOn(prismadb.users, "findMany").mockResolvedValue([] as any);
    jest.spyOn(prismadb.crm_Lead_Sources, "findMany").mockResolvedValue([] as any);
    jest.spyOn(prismadb.crm_Lead_Statuses, "findMany").mockResolvedValue([] as any);
    jest.spyOn(prismadb.crm_Lead_Types, "findMany").mockResolvedValue([] as any);
    jest.spyOn(prismadb.crm_Contact_Types, "findMany").mockResolvedValue([] as any);

    const rows = [
      // Row 1: Existing contact 1 (matched by email) - updates Customer Type to "Enterprise", leaves budget empty (preserves 50000 & cf-legacy)
      {
        "First Name": "Existing",
        "Last Name": "One",
        Email: "existing1@example.com",
        "Mobile Phone": "+1234567890",
        Company: "Acme Corp",
        "Customer Type": "enterprise", // case insensitive option match
        "Annual Budget": "", // empty -> should not overwrite existing 50000
        "Department Name": "Engineering",
        "Extra Column": "Preserved Info",
      },
      // Row 2: Existing contact 2 (matched by mobile phone) - updates Annual Budget
      {
        "First Name": "Existing",
        "Last Name": "Two",
        Email: "newemail2@example.com",
        "Mobile Phone": "+1987654321",
        Company: "Beta LLC",
        "Customer Type": "",
        "annual_budget": "$120,000",
        "Department Name": "Sales",
      },
      // Row 3: New contact 1
      {
        "First Name": "Alice",
        "Last Name": "Smith",
        Email: "alice@example.com",
        "Mobile Phone": "+1112223334",
        Company: "Gamma Inc",
        "Customer Type": "VIP",
        "Annual Budget": "75000",
        "Department Name": "Marketing",
      },
      // Row 4: New contact 2 with header variations
      {
        "First Name": "Bob",
        "Last Name": "Jones",
        Email: "bob@example.com",
        "Mobile Phone": "+2223334445",
        Company: "Delta Co",
        "customer_type": "standard",
        "Annual Budget": "25000",
        "department name": "Support",
      },
      // Row 5: New contact 3 with empty custom field cell and unknown column
      {
        "First Name": "Charlie",
        "Last Name": "Brown",
        Email: "charlie@example.com",
        "Mobile Phone": "+3334445556",
        Company: "Epsilon Ltd",
        "Customer Type": "",
        "Annual Budget": "40000",
        "Unknown Custom Column": "Special Tag",
      },
    ];

    const result = await importContacts(
      rows,
      { contactType: "customer", userId: "user-1", importBatchId: "BATCH1" },
      customFields,
    );

    if (result.validationErrors.length > 0) {
      console.log("Validation errors:", JSON.stringify(result.validationErrors, null, 2));
    }

    // Verify import summary
    expect(result.totalRows).toBe(5);
    expect(result.importedRows).toBe(3);
    expect(result.updatedRows).toBe(2);
    expect(result.failedRows).toBe(0);

    // Verify Updated Records (Custom fields merged!)
    expect(updatedRecords).toHaveLength(2);

    // Existing Record 1 Update check:
    expect(updatedRecords[0].id).toBe("cont-existing-1");
    expect(updatedRecords[0].custom_fields_data).toEqual({
      "cf-type": "Enterprise", // updated
      "cf-budget": "50000", // preserved!
      "cf-legacy": "Legacy Note", // preserved!
      "cf-dept": "Engineering", // added
      "Extra Column": "Preserved Info", // unknown column preserved
    });

    // Existing Record 2 Update check:
    expect(updatedRecords[1].id).toBe("cont-existing-2");
    expect(updatedRecords[1].custom_fields_data).toEqual({
      "cf-type": "VIP", // preserved!
      "cf-budget": "120000", // added/updated from "$120,000"
      "cf-dept": "Sales", // added
    });

    // Verify Created Records
    expect(createdRecords).toHaveLength(3);

    // New Contact 1
    expect(createdRecords[0].first_name).toBe("Alice");
    expect(createdRecords[0].custom_fields_data).toEqual({
      "cf-type": "VIP",
      "cf-budget": "75000",
      "cf-dept": "Marketing",
    });

    // New Contact 2
    expect(createdRecords[1].first_name).toBe("Bob");
    expect(createdRecords[1].custom_fields_data).toEqual({
      "cf-type": "Standard",
      "cf-budget": "25000",
      "cf-dept": "Support",
    });

    // New Contact 3
    expect(createdRecords[2].first_name).toBe("Charlie");
    expect(createdRecords[2].custom_fields_data).toEqual({
      "cf-budget": "40000",
      "Unknown Custom Column": "Special Tag",
    });
  });
});