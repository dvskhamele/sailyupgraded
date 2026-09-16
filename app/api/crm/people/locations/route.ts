import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getPeopleLocations } from "@/actions/crm/people/get-people";

export async function GET(req: NextRequest) {
  try {
    const debugId = req.headers.get("x-people-debug-id") || `locations-api-${Date.now().toString(36)}`;
    const session = await getSession();
    if (!session) {
      console.warn("[PEOPLE_LOCATIONS_API_REQUEST]", { debugId, status: 401, reason: "missing-session" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    console.info("[PEOPLE_LOCATIONS_API_REQUEST]", { debugId, path: "/api/crm/people/locations", filterKeys: ["country", "state", "city", "company_q"].filter((key) => searchParams.has(key)) });
    const result = await getPeopleLocations({
      country: searchParams.get("country") || undefined,
      state: searchParams.get("state") || undefined,
      city: searchParams.get("city") || undefined,
      companyQuery: searchParams.get("company_q") || undefined,
      debugId,
    });
    if (!result.success) {
      console.error("[PEOPLE_LOCATIONS_API_RESPONSE]", { debugId, status: 502, success: false, error: result.error || "Apollo locations unavailable" });
      return NextResponse.json(result, { status: 502 });
    }
    console.info("[PEOPLE_LOCATIONS_API_RESPONSE]", { debugId, status: 200, success: true, countries: result.countries.length, states: result.states.length, cities: result.cities.length, companies: result.companies.length });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PEOPLE_LOCATIONS_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
