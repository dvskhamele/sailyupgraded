import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getPeopleLocations } from "@/actions/crm/people/get-people";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getPeopleLocations();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PEOPLE_LOCATIONS_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
