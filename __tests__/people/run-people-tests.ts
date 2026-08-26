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
import { getContactsMenuItem } from "../../app/[locale]/(routes)/components/menu-items/Contacts";

async function runPeopleTests() {
  console.log("=== Starting People Unified Data Test Suite ===\n");

  // TEST 1: Sidebar order verification
  console.log("[TEST 1] Testing Sidebar Navigation Order...");
  const contactsMenuItem = getContactsMenuItem();
  assert.strictEqual(contactsMenuItem.title, "Contacts");
  assert.strictEqual(contactsMenuItem.url, "/crm/contacts");
  assert.ok(Array.isArray(contactsMenuItem.items), "Contacts must have items");

  const itemTitles = contactsMenuItem.items!.map((i) => i.title);
  console.log("  Sidebar items:", itemTitles);

  assert.strictEqual(itemTitles[0], "People", "First subitem must be People");
  assert.strictEqual(itemTitles[1], "Leads", "Second subitem must be Leads");
  assert.strictEqual(contactsMenuItem.items![0].url, "/crm/people");
  assert.strictEqual(contactsMenuItem.items![1].url, "/crm/leads");
  console.log("✓ Sidebar order is correctly Contacts -> People -> Leads\n");

  // TEST 2: Unified People Service with Live External APIs & Stats
  console.log("[TEST 2] Testing getUnifiedPeople with live microservice & stats...");
  const resultAll = await getUnifiedPeople({ limit: 50 });
  assert.strictEqual(resultAll.success, true);
  assert.ok(resultAll.data.length > 0, "Data should contain records");

  console.log(`  Total unified records loaded: ${resultAll.data.length}`);
  console.log(`  Total Database Stats:`, resultAll.stats);
  assert.ok(resultAll.stats, "Stats must be returned");
  assert.strictEqual(resultAll.stats?.totalAccounts, 5249249);
  assert.strictEqual(resultAll.stats?.totalContacts, 999982);
  assert.strictEqual(resultAll.stats?.totalRecords, 6249231);
  console.log("✓ Live stats correctly show 6.25M+ total records (5.25M Accounts, 1M Contacts)\n");

  // TEST 3: Type Filtering
  console.log("[TEST 3] Testing Type filtering in getUnifiedPeople...");
  const resultAccountsOnly = await getUnifiedPeople({ type: "Account", limit: 20 });
  assert.strictEqual(resultAccountsOnly.success, true);
  assert.ok(resultAccountsOnly.data.every((r) => r.type === "Account"), "All records must be Accounts");

  const resultContactsOnly = await getUnifiedPeople({ type: "Contact", limit: 20 });
  assert.strictEqual(resultContactsOnly.success, true);
  assert.ok(resultContactsOnly.data.every((r) => r.type === "Contact"), "All records must be Contacts");
  console.log("✓ Type filtering works for Accounts and Contacts\n");

  // TEST 4: Field Mapping Integrity
  console.log("[TEST 4] Testing Field mapping & metadata integrity...");
  const sampleAccount = resultAll.data.find((r) => r.type === "Account")!;
  assert.ok(sampleAccount.id.startsWith("acc-"));
  assert.ok(sampleAccount.name.length > 0);
  assert.strictEqual(sampleAccount.type, "Account");
  assert.ok(sampleAccount.raw !== undefined);

  const sampleContact = resultAll.data.find((r) => r.type === "Contact")!;
  assert.ok(sampleContact.id.startsWith("con-"));
  assert.ok(sampleContact.name.length > 0);
  assert.strictEqual(sampleContact.type, "Contact");
  assert.ok(sampleContact.raw !== undefined);
  console.log("  Sample Account verified:", { id: sampleAccount.id, name: sampleAccount.name });
  console.log("  Sample Contact verified:", { id: sampleContact.id, name: sampleContact.name, company: sampleContact.company });
  console.log("✓ Field mapping integrity verified\n");

  // TEST 5: Search Querying across full dataset
  console.log("[TEST 5] Testing Search functionality across combined APIs...");
  const searchResult = await getUnifiedPeople({ query: "toyota" });
  assert.strictEqual(searchResult.success, true);
  console.log(`  Found ${searchResult.data.length} records matching 'toyota'`);
  assert.ok(searchResult.data.length > 0, "Should find records for 'toyota'");
  console.log("✓ Search querying across Accounts & Contacts passed\n");

  console.log("==============================================");
  console.log("ALL 5 PEOPLE TESTS PASSED SUCCESSFULLY!");
  console.log("==============================================");
}

runPeopleTests().catch((err) => {
  console.error("People tests failed:", err);
  process.exit(1);
});
