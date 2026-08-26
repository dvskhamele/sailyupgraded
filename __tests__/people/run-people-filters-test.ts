import "dotenv/config";
import module from "module";

// Mock 'server-only' for standalone node runner
const originalRequire = module.prototype.require;
// @ts-ignore
module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  if (id === "next/headers") {
    return {
      headers: async () => new Headers(),
      cookies: async () => ({ get: () => undefined }),
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import assert from "assert";
import { getUnifiedPeople } from "../../actions/crm/people/get-people";

async function runFilterTests() {
  console.log("=== Starting Comprehensive People Filter Test Suite ===\n");

  // TEST 1: Unfiltered baseline
  console.log("[TEST 1] Testing Unfiltered Baseline...");
  const base = await getUnifiedPeople({ limit: 100 });
  assert.strictEqual(base.success, true);
  console.log(`  Loaded ${base.data.length} baseline records (Accounts: ${base.data.filter(r => r.type === "Account").length}, Contacts: ${base.data.filter(r => r.type === "Contact").length})`);
  assert.ok(base.data.length > 0);
  console.log("✓ Unfiltered baseline loaded\n");

  // TEST 2: Type Filter = Account
  console.log("[TEST 2] Testing Type = Account filter...");
  const accountsOnly = await getUnifiedPeople({ type: "Account", limit: 50 });
  assert.strictEqual(accountsOnly.success, true);
  assert.ok(accountsOnly.data.length > 0);
  assert.ok(accountsOnly.data.every((r) => r.type === "Account"), "All records MUST be Accounts");
  console.log(`  ✓ Type = Account returned ${accountsOnly.data.length} records, 100% are Accounts\n`);

  // TEST 3: Type Filter = Contact
  console.log("[TEST 3] Testing Type = Contact filter...");
  const contactsOnly = await getUnifiedPeople({ type: "Contact", limit: 50 });
  assert.strictEqual(contactsOnly.success, true);
  assert.ok(contactsOnly.data.length > 0);
  assert.ok(contactsOnly.data.every((r) => r.type === "Contact"), "All records MUST be Contacts");
  console.log(`  ✓ Type = Contact returned ${contactsOnly.data.length} records, 100% are Contacts\n`);

  // TEST 4: Country / Location Filter
  console.log("[TEST 4] Testing Country = United States filter...");
  const countryFilter = await getUnifiedPeople({ country: "United States", limit: 100 });
  assert.strictEqual(countryFilter.success, true);
  console.log(`  Found ${countryFilter.data.length} records matching 'United States'`);
  assert.ok(
    countryFilter.data.every((r) => {
      const txt = [r.country, r.city, r.state, r.address].filter(Boolean).join(" ").toLowerCase();
      return txt.includes("united states");
    }),
    "Every record must match country query"
  );
  console.log("  ✓ Location filter verified\n");

  // TEST 5: Has Email Quality Filter
  console.log("[TEST 5] Testing hasEmail = true filter...");
  const emailFilter = await getUnifiedPeople({ hasEmail: true, limit: 100 });
  assert.strictEqual(emailFilter.success, true);
  console.log(`  Found ${emailFilter.data.length} records with valid email`);
  assert.ok(
    emailFilter.data.every((r) => Boolean(r.email && r.email.includes("@"))),
    "Every record must contain a valid @ email"
  );
  console.log("  ✓ Has Email filter verified\n");

  // TEST 6: Has LinkedIn Quality Filter
  console.log("[TEST 6] Testing hasLinkedin = true filter...");
  const linkedinFilter = await getUnifiedPeople({ hasLinkedin: true, limit: 100 });
  assert.strictEqual(linkedinFilter.success, true);
  console.log(`  Found ${linkedinFilter.data.length} records with LinkedIn profile`);
  assert.ok(
    linkedinFilter.data.every((r) => Boolean(r.socialLinkedin && r.socialLinkedin.trim())),
    "Every record must contain LinkedIn URL"
  );
  console.log("  ✓ Has LinkedIn filter verified\n");

  // TEST 7: Multi-Filter Combination (AND Logic: Type + Country + hasEmail)
  console.log("[TEST 7] Testing Multi-Filter: Type=Contact AND Country=United States AND hasEmail=true...");
  const multiFilter = await getUnifiedPeople({
    type: "Contact",
    country: "United States",
    hasEmail: true,
    limit: 100,
  });
  assert.strictEqual(multiFilter.success, true);
  console.log(`  Found ${multiFilter.data.length} records matching all 3 conditions simultaneously`);
  assert.ok(
    multiFilter.data.every((r) => {
      const isContact = r.type === "Contact";
      const hasEmail = Boolean(r.email && r.email.includes("@"));
      const isUS = [r.country, r.city, r.state, r.address].filter(Boolean).join(" ").toLowerCase().includes("united states");
      return isContact && hasEmail && isUS;
    }),
    "All records MUST satisfy ALL active conditions simultaneously"
  );
  console.log("  ✓ Multi-filter AND combination verified\n");

  // TEST 8: Search + Filters Combination
  console.log("[TEST 8] Testing Search + Filter: query='toyota' AND hasEmail=true...");
  const searchPlusFilter = await getUnifiedPeople({
    query: "toyota",
    hasEmail: true,
  });
  assert.strictEqual(searchPlusFilter.success, true);
  console.log(`  Found ${searchPlusFilter.data.length} records matching query 'toyota' + valid email`);
  assert.ok(
    searchPlusFilter.data.every((r) => Boolean(r.email && r.email.includes("@"))),
    "Every search result must satisfy the filter"
  );
  console.log("  ✓ Search + Filter combined execution verified\n");

  // TEST 9: Empty Filter / Reset Verification
  console.log("[TEST 9] Testing Filter Reset back to full dataset...");
  const resetResult = await getUnifiedPeople({ limit: 50 });
  assert.strictEqual(resetResult.success, true);
  assert.strictEqual(resetResult.stats?.totalRecords, 6249231);
  console.log("  ✓ Filter reset restored full dataset scope\n");

  console.log("==============================================");
  console.log("ALL 9 FILTER INTEGRATION TESTS PASSED!");
  console.log("==============================================");
}

runFilterTests().catch((err) => {
  console.error("Filter tests failed:", err);
  process.exit(1);
});
