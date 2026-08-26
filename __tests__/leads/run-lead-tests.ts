import "dotenv/config";
import module from "module";

// Mock 'server-only' for standalone node runner
const originalRequire = module.prototype.require;
// @ts-ignore
module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

// Reset column name cache before anything runs
(global as any).cachedPrismaDbColumnNames = new Map();

import assert from "assert";
import {
  buildLeadUpdateData,
  bulkEnrichLeads,
} from "../../lib/leads/lead-enrichment-service";
import {
  isValidString,
  parseEmailInfo,
  EnrichedPersonData,
  enrichPersonData,
} from "../../lib/enrichment/external-enrichment-service";
import { extractDomainFromUrl } from "../../lib/enrichment/account-enrichment-service";
import type { crm_Leads } from "@prisma/client";

async function runTests() {
  console.log("=== Starting Leads Enrichment Test Suite ===");

  // TEST 1: isValidString & parseEmailInfo
  console.log("\n[TEST 1] Testing string validation and email parsing...");
  assert.strictEqual(isValidString("hello"), true);
  assert.strictEqual(isValidString("  "), false);
  assert.strictEqual(isValidString(null), false);
  assert.strictEqual(isValidString("undefined"), false);
  assert.strictEqual(isValidString("n/a"), false);
  assert.strictEqual(isValidString("Unavailable"), false);

  const emailInfo1 = parseEmailInfo("john.doe@company.com");
  assert.strictEqual(emailInfo1.domain, "company.com");
  assert.strictEqual(emailInfo1.companyGuess, "Company");
  assert.strictEqual(emailInfo1.isPersonal, false);
  assert.strictEqual(emailInfo1.firstNameGuess, "John");
  assert.strictEqual(emailInfo1.lastNameGuess, "Doe");

  const emailInfo2 = parseEmailInfo("alice@gmail.com");
  assert.strictEqual(emailInfo2.domain, "gmail.com");
  assert.strictEqual(emailInfo2.isPersonal, true);
  assert.strictEqual(emailInfo2.companyGuess, null);

  console.log("✓ String validation and email parsing passed");

  // TEST 2: Domain Extraction for Account Deduplication
  console.log("\n[TEST 2] Testing domain extraction...");
  assert.strictEqual(extractDomainFromUrl("https://www.google.com/about"), "google.com");
  assert.strictEqual(extractDomainFromUrl("http://sub.domain.co.uk/path"), "sub.domain.co.uk");
  assert.strictEqual(extractDomainFromUrl("acme.org"), "acme.org");
  console.log("✓ Domain extraction passed");

  // TEST 3: Safe Field Overwrite for Leads
  console.log("\n[TEST 3] Testing safe field overwrite on Lead...");
  const baseLead = {
    id: "lead-test-123",
    firstName: "Rahul",
    lastName: "Sharma",
    email: "rahul@existing.com",
    personal_email: null,
    phone: "+91 9999999999",
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
    custom_fields_data: { initial_tag: "lead_web" },
  } as unknown as crm_Leads;

  const enrichedPerson: EnrichedPersonData = {
    first_name: "Rahul",
    last_name: "Sharma",
    email: "different_rahul@other.com",
    phone: "+91 8888888888",
    job_title: "Chief Technology Officer",
    company_name: "ABC Technologies",
    company_website: "https://abctech.com",
    linkedin_url: "https://linkedin.com/in/rahulsharma",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    postal_code: "560001",
    industry: "Information Technology",
    company_size: "500-1000",
  };

  const { updateData, updatedFieldNames } = buildLeadUpdateData(
    baseLead,
    enrichedPerson,
    "org-abc-123"
  );

  // Existing phone & email must NOT be overwritten
  assert.strictEqual(updateData.phone, undefined, "Existing lead phone must not be overwritten");
  assert.strictEqual(updateData.email, undefined, "Existing lead email must not be overwritten");

  // Empty fields MUST be filled
  assert.strictEqual(updateData.jobTitle, "Chief Technology Officer");
  assert.strictEqual(updateData.company, "ABC Technologies");
  assert.strictEqual(updateData.website, "https://abctech.com");
  assert.strictEqual(updateData.social_linkedin, "https://linkedin.com/in/rahulsharma");
  assert.strictEqual(updateData.city, "Bangalore");
  assert.strictEqual(updateData.state, "Karnataka");
  assert.strictEqual(updateData.country, "India");
  assert.strictEqual(updateData.postal_code, "560001");
  assert.strictEqual(updateData.accountsIDs, "org-abc-123");

  // Custom fields must preserve existing data while adding new fields
  assert.deepStrictEqual(updateData.custom_fields_data, {
    initial_tag: "lead_web",
    industry: "Information Technology",
    company_size: "500-1000",
  });

  assert.ok(updatedFieldNames.includes("jobTitle"));
  assert.ok(updatedFieldNames.includes("company"));
  assert.ok(updatedFieldNames.includes("accountsIDs"));
  assert.ok(updatedFieldNames.includes("industry"));

  console.log("✓ Safe field overwrite passed");

  // TEST 4: Full Name Parsing Fallback
  console.log("\n[TEST 4] Testing full name parsing when first/last name empty...");
  const emptyNameLead = {
    id: "lead-test-2",
    firstName: "",
    lastName: null,
  } as unknown as crm_Leads;

  const enrichedWithFullName: EnrichedPersonData = {
    full_name: "Satish Parekh",
  };

  const nameResult = buildLeadUpdateData(emptyNameLead, enrichedWithFullName);
  assert.strictEqual(nameResult.updateData.firstName, "Satish");
  assert.strictEqual(nameResult.updateData.lastName, "Parekh");
  console.log("✓ Full name parsing passed");

  // TEST 5: Pure Enrichment Function (No Database Side Effects)
  console.log("\n[TEST 5] Testing pure enrichment function...");
  const enrichResult = await enrichPersonData({
    email: "magdalena.nowak-coventry@toyota-europe.com",
    firstName: "Magdalena",
    lastName: "Nowak-Coventry",
    company: "Toyota Motor Europe",
  });

  assert.strictEqual(enrichResult.success, true);
  assert.strictEqual(enrichResult.personFound, true);
  assert.ok(enrichResult.person);
  console.log("✓ Pure enrichment function passed with result:", {
    personFound: enrichResult.personFound,
    companyFound: enrichResult.companyFound,
    company: enrichResult.company?.name,
  });

  // TEST 6: Contact vs Lead Independence Verification
  console.log("\n[TEST 6] Testing Contact vs Lead Complete Independence...");
  let leadUpdateCalled = false;
  let contactUpdateCalled = false;

  const mockLead = {
    id: "L456",
    firstName: "Magdalena",
    lastName: "Nowak-Coventry",
    email: "magdalena.nowak-coventry@toyota-europe.com",
    company: "Toyota Motor Europe",
    website: null,
    phone: null,
    accountsIDs: null,
    deletedAt: null,
  };

  const mockClient = {
    crm_Leads: {
      findMany: async () => [mockLead],
      findUnique: async () => mockLead,
      update: async ({ where, data }: any) => {
        leadUpdateCalled = true;
        return { ...mockLead, ...data, id: where.id };
      },
    },
    crm_Accounts: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: "acc-123", ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    crm_Contacts: {
      findMany: async () => {
        throw new Error("CRITICAL FAILURE: crm_Contacts.findMany must NEVER be called during Lead enrichment!");
      },
      findUnique: async () => {
        throw new Error("CRITICAL FAILURE: crm_Contacts.findUnique must NEVER be called during Lead enrichment!");
      },
      update: async () => {
        contactUpdateCalled = true;
        throw new Error("CRITICAL FAILURE: crm_Contacts.update must NEVER be called during Lead enrichment!");
      },
    },
    apiKeys: {
      findFirst: async () => null,
    },
    $queryRaw: async () => [],
  };

  (global as any).customPrismaMock = mockClient;

  try {
    const res = await bulkEnrichLeads(["L456"], "test-user-id");
    assert.strictEqual(res.success, true);
    assert.strictEqual(leadUpdateCalled, true, "Lead update must be called");
    assert.strictEqual(contactUpdateCalled, false, "Contact update was called during Lead enrichment!");
    console.log("✓ Lead enrichment updated ONLY crm_Leads, crm_Contacts was NEVER touched");
  } finally {
    delete (global as any).customPrismaMock;
  }

  console.log("\n==============================================");
  console.log("ALL 6 UNIT AND INTEGRATION TESTS PASSED!");
  console.log("==============================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
