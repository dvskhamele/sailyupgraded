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
import { getUnifiedPeople, getPeopleLocations } from "../../actions/crm/people/get-people";

async function runFilterTests() {
  console.log("=== Starting Comprehensive People Filter Test Suite ===\n");

  // This live smoke test is opt-in; the deterministic contract test runs below.
  if (process.env.RUN_LIVE_APOLLO_FILTER_TESTS === "true") {
  // TEST 1: Dynamic People Locations Aggregation
  console.log("[TEST 1] Testing Dynamic Locations Aggregation (getPeopleLocations)...");
  const locsResult = await getPeopleLocations();
  assert.strictEqual(locsResult.success, true);
  assert.ok(Array.isArray(locsResult.locations), "locations must be an array");
  console.log(`  Aggregated ${locsResult.locations.length} unique locations (${locsResult.countries.length} countries, ${locsResult.cities.length} cities)`);
  
  // Verify deduplication
  const lowerValues = locsResult.locations.map((l) => l.value.toLowerCase().trim());
  const uniqueCount = new Set(lowerValues).size;
  assert.strictEqual(uniqueCount, lowerValues.length, "All location values must be unique and deduplicated");

  // Verify alphabetical sorting
  const labels = locsResult.locations.map((l) => l.label);
  const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  assert.deepStrictEqual(labels, sortedLabels, "Locations must be sorted alphabetically");
  console.log("  ✓ Dynamic locations aggregation, deduplication, and alphabetical sorting verified\n");

  }

  // Mock Apollo contacts dataset to test filter logic without external network dependence
  const originalFetch = global.fetch;
  let lastFetchedUrl = "";

  const mockContacts = [
    {
      id: "c1",
      first_name: "John",
      last_name: "Doe",
      company: "Toyota Motor",
      jobTitle: "Manager",
      email: "john@toyota.com",
      phone: "+1-555-1111",
      social_linkedin: "https://linkedin.com/in/johndoe",
      city: "Torrance",
      state: "CA",
      country: "United States",
      status: "1",
    },
    {
      id: "c2",
      first_name: "Sarah",
      last_name: "Connor",
      company: "Cyberdyne Systems",
      jobTitle: "Security Lead",
      email: "sarah@cyberdyne.com",
      phone: "Unavailable",
      mobile_phone: "+1-555-2222",
      social_linkedin: "https://linkedin.com/in/sarahconnor",
      city: "Los Angeles",
      state: "CA",
      country: "United States",
      status: "0",
    },
    {
      id: "c3", first_name: "Priya", last_name: "Shah", company: "Saily", jobTitle: "Director",
      email: "priya@saily.com", city: "Mumbai", state: "Maharashtra", country: "India", status: "1",
    },
    {
      id: "c4", first_name: "Alex", last_name: "Chen", company: "Saily", jobTitle: "Director",
      email: "alex@saily.com", city: "Mumbai", state: "Maharashtra", country: "India", status: "0",
    },
  ];

  const mockAccounts = [
    {
      id: "a1",
      name: "Acme Global",
      company: "Acme Global",
      email: "info@acmeglobal.com",
      phone: "+1-555-3333",
      city: "New York",
      state: "NY",
      country: "United States",
    },
  ];

  try {
    // @ts-ignore
    global.fetch = async (url: string | URL | Request) => {
      lastFetchedUrl = String(url);
      const urlStr = String(url);
      const requestUrl = new URL(urlStr);
      if (requestUrl.pathname.endsWith("/contacts/filters")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            countries: ["India", "United States"],
            states: ["CA", "Maharashtra"],
            cities: ["Los Angeles", "Mumbai", "Torrance"],
            companies: ["Cyberdyne Systems", "Saily", "Toyota Motor"],
          }),
        } as Response;
      }
      const isAccount = urlStr.includes("/accounts");
      const status = requestUrl.searchParams.get("status");
      const filtered = isAccount
        ? mockAccounts
        : mockContacts.filter((contact) => !status || contact.status === status);
      const offset = Number(requestUrl.searchParams.get("offset") || "0");
      const limit = Number(requestUrl.searchParams.get("limit") || "50");
      const data = filtered.slice(offset, offset + limit);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "x-total-count": String(filtered.length) }),
        json: async () => ({
          success: true,
          data,
          total: filtered.length,
          page: Number(requestUrl.searchParams.get("page") || "1"),
          limit,
          totalPages: Math.ceil(filtered.length / limit),
        }),
      } as Response;
    };

    // TEST 2: Unfiltered baseline
    console.log("[TEST 2] Testing Unfiltered Baseline...");
    const base = await getUnifiedPeople({ limit: 100 });
    assert.strictEqual(base.success, true);
    assert.strictEqual(base.source, "apollo");
    assert.ok(base.data.length > 0);
    console.log("✓ Unfiltered baseline loaded\n");

    // TEST 3: Type Filter = Account
    console.log("[TEST 3] Testing Type = Account filter...");
    const accountsOnly = await getUnifiedPeople({ type: "Account", limit: 50 });
    assert.strictEqual(accountsOnly.success, true);
    assert.ok(lastFetchedUrl.includes("/accounts"));
    assert.ok(accountsOnly.data.every((r) => r.type === "Account"), "All records MUST be Accounts");
    console.log(`  ✓ Type = Account fetched from /accounts endpoint and returned Account records\n`);

    // TEST 4: Type Filter = Contact
    console.log("[TEST 4] Testing Type = Contact filter...");
    const contactsOnly = await getUnifiedPeople({ type: "Contact", limit: 50 });
    assert.strictEqual(contactsOnly.success, true);
    assert.ok(lastFetchedUrl.includes("/contacts"));
    assert.ok(contactsOnly.data.every((r) => r.type === "Contact"), "All records MUST be Contacts");
    console.log(`  ✓ Type = Contact fetched from /contacts endpoint and returned Contact records\n`);

    // TEST 5: Country / Location Filter forwarded to Apollo
    console.log("[TEST 5] Testing Country = United States filter...");
    await getUnifiedPeople({ country: "United States", limit: 100 });
    assert.ok(lastFetchedUrl.includes("country=United+States") || lastFetchedUrl.includes("country=United%20States"));
    console.log("  ✓ Country filter parameter forwarded to Apollo API\n");

    // TEST 6: Has Email Quality Filter forwarded to Apollo
    console.log("[TEST 6] Testing hasEmail = true filter...");
    await getUnifiedPeople({ hasEmail: true, limit: 100 });
    assert.ok(lastFetchedUrl.includes("hasEmail=true"));
    console.log("  ✓ hasEmail filter forwarded to Apollo API\n");

    // TEST 7: Has LinkedIn Quality Filter forwarded to Apollo
    console.log("[TEST 7] Testing hasLinkedin = true filter...");
    await getUnifiedPeople({ hasLinkedin: true, limit: 100 });
    assert.ok(lastFetchedUrl.includes("hasLinkedin=true"));
    console.log("  ✓ hasLinkedin filter forwarded to Apollo API\n");

    // TEST 8: Multi-Filter Combination
    console.log("[TEST 8] Testing Multi-Filter: Type=Contact AND Country=United States AND hasEmail=true...");
    await getUnifiedPeople({
      type: "Contact",
      country: "United States",
      hasEmail: true,
      limit: 100,
    });
    assert.ok(lastFetchedUrl.includes("/contacts"));
    assert.ok(lastFetchedUrl.includes("country="));
    assert.ok(lastFetchedUrl.includes("hasEmail=true"));
    console.log("  ✓ Multi-filter parameters forwarded to Apollo API\n");

    // TEST 9: Search Query forwarded to Apollo before pagination
    console.log("[TEST 9] Testing Search + Filter: query='parekh satish' AND hasEmail=true...");
    await getUnifiedPeople({
      query: "parekh satish",
      hasEmail: true,
    });
    assert.ok(lastFetchedUrl.includes("q=parekh+satish"));
    assert.ok(lastFetchedUrl.includes("hasEmail=true"));
    console.log("  ✓ Search query and filter forwarded to Apollo API\n");

    // TEST 10: Search variants, clearing, Account filter, and search pagination.
    for (const query of ["parekh", "satish"]) {
      await getUnifiedPeople({ query, limit: 50, page: 1 });
      assert.ok(lastFetchedUrl.includes(`q=${query}`));
      assert.ok(lastFetchedUrl.includes("offset=0"));
    }
    await getUnifiedPeople({ limit: 50, page: 1 });
    assert.ok(!lastFetchedUrl.includes("q="), "clearing search must omit q");
    await getUnifiedPeople({
      query: "parekh satish",
      type: "Account",
      company: "Saily",
      limit: 50,
      page: 1,
    });
    assert.ok(lastFetchedUrl.includes("/accounts"));
    assert.ok(lastFetchedUrl.includes("q=parekh+satish"));
    assert.ok(lastFetchedUrl.includes("company=Saily"));
    await getUnifiedPeople({ query: "parekh satish", limit: 50, page: 2 });
    assert.ok(lastFetchedUrl.includes("q=parekh+satish"));
    assert.ok(lastFetchedUrl.includes("offset=50"));
    console.log("  ✓ Search variants, clear, Account filter, and pagination are server-side\n");

    // TEST 11: Filter option contract is populated from Apollo's bounded metadata endpoint.
    const options = await getPeopleLocations({ country: "India", state: "Maharashtra", companyQuery: "Saily" });
    assert.strictEqual(options.success, true);
    assert.deepStrictEqual(options.countries, ["India", "United States"]);
    assert.deepStrictEqual(options.states, ["CA", "Maharashtra"]);
    assert.deepStrictEqual(options.cities, ["Los Angeles", "Mumbai", "Torrance"]);
    assert.deepStrictEqual(options.companies, ["Cyberdyne Systems", "Saily", "Toyota Motor"]);
    const locationValues = options.locations.map((location) => location.value.toLowerCase().trim());
    assert.strictEqual(new Set(locationValues).size, locationValues.length, "locations must be deduplicated");
    const labels = options.locations.map((location) => location.label);
    assert.deepStrictEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
    assert.ok(lastFetchedUrl.includes("/contacts/filters"));
    assert.ok(lastFetchedUrl.includes("country=India"));
    assert.ok(lastFetchedUrl.includes("state=Maharashtra"));
    assert.ok(lastFetchedUrl.includes("company_q=Saily"));
    console.log("  ✓ Filter option contract populates all four dropdowns\n");

    // TEST 12: UI labels translate to Apollo's numeric flags before pagination,
    // and numeric flags translate back to the expected label on every page.
    for (const [label, raw] of [["Active", "1"], ["Inactive", "0"]] as const) {
      for (const page of [1, 2]) {
        const result = await getUnifiedPeople({ status: label, country: "India", limit: 1, page });
        assert.ok(lastFetchedUrl.includes(`status=${raw}`), `${label} must use Apollo status ${raw}`);
        assert.ok(lastFetchedUrl.includes("country=India"), "country filter must persist across pages");
        assert.ok(lastFetchedUrl.includes(`page=${page}`));
        assert.ok(lastFetchedUrl.includes(`offset=${page - 1}`));
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].status, label);
      }
    }
    console.log("  ✓ Active/Inactive mapping and page 1/page 2 filter persistence verified\n");
  } finally {
    global.fetch = originalFetch;
  }

  console.log("==============================================");
  console.log("ALL FILTER INTEGRATION TESTS PASSED!");
  console.log("==============================================");
}

runFilterTests().catch((err) => {
  console.error("Filter tests failed:", err);
  process.exit(1);
});
