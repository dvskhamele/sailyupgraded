import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getPeopleLocations } from "@/actions/crm/people/get-people";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const result = await getPeopleLocations({
      country: searchParams.get("country") || undefined,
      state: searchParams.get("state") || undefined,
      city: searchParams.get("city") || undefined,
      companyQuery: searchParams.get("company_q") || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PEOPLE_LOCATIONS_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
