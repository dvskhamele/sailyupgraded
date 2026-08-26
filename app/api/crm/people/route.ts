import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getUnifiedPeople } from "@/actions/crm/people/get-people";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || searchParams.get("q") || "";
    const typeParam = searchParams.get("type") || "All";
    const type = typeParam === "Account" || typeParam === "Contact" ? typeParam : "All";
    const limit = parseInt(searchParams.get("limit") || "500", 10);
    const country = searchParams.get("country") || undefined;
    const status = searchParams.get("status") || undefined;
    const role = searchParams.get("role") || undefined;
    const hasEmail = searchParams.get("hasEmail") === "true" ? true : undefined;
    const hasPhone = searchParams.get("hasPhone") === "true" ? true : undefined;
    const hasLinkedin = searchParams.get("hasLinkedin") === "true" ? true : undefined;
    const hasCompany = searchParams.get("hasCompany") === "true" ? true : undefined;

    const result = await getUnifiedPeople({
      query,
      type,
      limit,
      country,
      status,
      role,
      hasEmail,
      hasPhone,
      hasLinkedin,
      hasCompany,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PEOPLE_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
