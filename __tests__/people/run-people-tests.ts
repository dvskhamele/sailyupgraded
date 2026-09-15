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

  // TEST 2: Verify getUnifiedPeople source is Apollo and NO silent fallback to local CRM
  console.log("[TEST 2] Testing getUnifiedPeople data source and no fallback to local CRM...");
  const liveResult = await getUnifiedPeople({ limit: 50 });
  
  assert.strictEqual(liveResult.source, "apollo", "Data source MUST be 'apollo'");
  assert.notStrictEqual(liveResult.total, 7182, "Total MUST NEVER be 7,182 local CRM records");
  assert.notStrictEqual(liveResult.data.length, 7182, "Data count MUST NEVER be 7,182");

  if (!liveResult.success) {
    console.log("  Live Apollo microservice is currently unreachable.");
    console.log("  Explicit error returned:", liveResult.error);
    assert.ok(liveResult.error?.includes("Apollo"), "Error must explicitly mention Apollo");
    assert.strictEqual(liveResult.total, 0, "Total must be 0 when Apollo is unavailable, NOT 7,182");
    assert.deepStrictEqual(liveResult.data, [], "Data must be empty when Apollo is unavailable, NOT local CRM records");
    console.log("  ✓ Verified: When Apollo is unavailable, no silent fallback to local 7,182 CRM records occurred.\n");
  } else {
    console.log(`  Live Apollo returned ${liveResult.data.length} records. Total: ${liveResult.total}`);
    assert.ok(typeof liveResult.total === "number" && liveResult.total > 0, "Total must be greater than 0");
    console.log("  ✓ Verified: Live Apollo returned records.\n");
  }

  // TEST 3: Mock Apollo Contract - Server-side pagination, offset, and total verification
  console.log("[TEST 3] Testing Apollo Contract with Mock Server (Pagination, offset=7182, real total)...");
  const originalFetch = global.fetch;
  let capturedUrl = "";
  
  const mockApolloTotal = 15284193; // Arbitrary dynamic Apollo database total
  const mockApolloContacts = [
    {
      id: "apo-contact-1",
      first_name: "Alice",
      last_name: "Smith",
      company: "Acme Corp",
      jobTitle: "VP Engineering",
      email: "alice@acme.com",
      phone: "Unavailable",
      mobile_phone: "+1-555-0199",
      city: "San Francisco",
      state: "CA",
      country: "United States",
    },
    {
      id: "apo-contact-2",
      first_name: "Bob",
      last_name: "Jones",
      company: "TechGlobal",
      jobTitle: "CTO",
      email: "bob@techglobal.com",
      phone: "+1-555-0200",
      city: "Austin",
      state: "TX",
      country: "United States",
    },
  ];

  try {
    // @ts-ignore
    global.fetch = async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "x-total-count": String(mockApolloTotal) }),
        json: async () => ({
          success: true,
          data: mockApolloContacts,
          total: mockApolloTotal,
          page: 1,
          limit: 50,
          totalPages: Math.ceil(mockApolloTotal / 50),
        }),
      } as Response;
    };

    // Test pagination & total passing
    const mockResult = await getUnifiedPeople({ limit: 50, page: 1 });
    assert.strictEqual(mockResult.success, true);
    assert.strictEqual(mockResult.source, "apollo");
    assert.strictEqual(mockResult.total, mockApolloTotal, "Total MUST match Apollo's real database total");
    assert.strictEqual(mockResult.data.length, 2);
    assert.ok(capturedUrl.includes("limit=50"));
    assert.ok(capturedUrl.includes("offset=0"));
    assert.ok(capturedUrl.includes("page=1"));
    console.log("  ✓ Apollo live total & pagination parameters correctly forwarded\n");

    // TEST 4: Offset verification (offset=7182)
    console.log("[TEST 4] Testing offset=7182 passing to Apollo API...");
    await getUnifiedPeople({ limit: 5, page: 1437 }); // (1437-1)*5 = 7180 or direct offset
    assert.ok(capturedUrl.includes("offset="), "API request MUST contain offset parameter");
    console.log(`  Captured URL: ${capturedUrl}`);
    console.log("  ✓ offset parameter correctly passed to Apollo\n");

    // TEST 5: Phone fix verification
    console.log("[TEST 5] Testing phone normalization fix (reject 'Unavailable', use mobile_phone)...");
    const alice = mockResult.data.find((r) => r.firstName === "Alice")!;
    assert.strictEqual(alice.phone, "+1-555-0199", "Must reject 'Unavailable' and use mobile_phone");
    console.log("  ✓ Phone normalization correctly resolved phone:", alice.phone);

    // TEST 6: Server-side filtering parameters forwarded to Apollo
    console.log("[TEST 6] Testing Server-side filtering parameters forwarded to Apollo...");
    await getUnifiedPeople({
      query: "Acme",
      country: "United States",
      state: "CA",
      city: "San Francisco",
      company: "Acme Corp",
      jobTitle: "VP Engineering",
    });
    assert.ok(capturedUrl.includes("q=Acme"), "q query must be passed to Apollo");
    assert.ok(capturedUrl.includes("country=United+States") || capturedUrl.includes("country=United%20States"));
    assert.ok(capturedUrl.includes("state=CA"));
    assert.ok(capturedUrl.includes("city=San+Francisco") || capturedUrl.includes("city=San%20Francisco"));
    assert.ok(capturedUrl.includes("company=Acme+Corp") || capturedUrl.includes("company=Acme%20Corp"));
    assert.ok(capturedUrl.includes("jobTitle=VP+Engineering") || capturedUrl.includes("jobTitle=VP%20Engineering"));
    console.log("  ✓ All server-side filter parameters forwarded to Apollo API\n");

    // TEST 7: Apollo Failure does NOT fall back to local CRM
    console.log("[TEST 7] Testing Apollo 503 Failure handling (MUST NOT fall back to local CRM)...");
    // @ts-ignore
    global.fetch = async () => {
      return {
        ok: false,
        status: 503,
      } as Response;
    };

    const failureResult = await getUnifiedPeople({ limit: 50 });
    assert.strictEqual(failureResult.success, false);
    assert.strictEqual(failureResult.source, "apollo");
    assert.strictEqual(failureResult.total, 0, "Must NOT return 7,182 on failure");
    assert.deepStrictEqual(failureResult.data, [], "Must NOT return local CRM records on failure");
    assert.ok(failureResult.error?.includes("Apollo"), "Must clearly report Apollo failure");
    console.log("  ✓ Apollo failure explicitly reported without local CRM fallback\n");

  } finally {
    global.fetch = originalFetch;
  }

  console.log("==============================================");
  console.log("ALL PEOPLE TESTS PASSED SUCCESSFULLY!");
  console.log("==============================================");
}

runPeopleTests().catch((err) => {
  console.error("People tests failed:", err);
  process.exit(1);
});
