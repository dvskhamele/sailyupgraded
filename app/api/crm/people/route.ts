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

    const result = await getUnifiedPeople({ query, type, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PEOPLE_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
