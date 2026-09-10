import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getUnifiedPeople } from "@/actions/crm/people/get-people";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20);
    const country = searchParams.get("country") || undefined;
    const state = searchParams.get("state") || undefined;
    const city = searchParams.get("city") || undefined;
    const company = searchParams.get("company") || undefined;
    const jobTitle = searchParams.get("jobTitle") || searchParams.get("position") || undefined;
    const status = searchParams.get("status") || undefined;
    const role = searchParams.get("role") || undefined;
    const hasEmail = searchParams.get("hasEmail") === "true" ? true : undefined;
    const hasPhone = searchParams.get("hasPhone") === "true" ? true : undefined;
    const hasLinkedin = searchParams.get("hasLinkedin") === "true" ? true : undefined;
    const hasCompany = searchParams.get("hasCompany") === "true" ? true : undefined;

    const result = await getUnifiedPeople({
      query,
      type,
      page,
      limit,
      country,
      state,
      city,
      company,
      jobTitle,
      status,
      role,
      hasEmail,
      hasPhone,
      hasLinkedin,
      hasCompany,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          source: "apollo",
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          error: result.error || "Apollo API service is unavailable",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      source: "apollo",
      data: result.data,
      total: result.total,
      page: result.page || page,
      limit: result.limit || limit,
      totalPages: result.totalPages || (result.total > 0 ? Math.ceil(result.total / (result.limit || limit)) : 0),
      stats: result.stats,
    });
  } catch (error) {
    console.error("[PEOPLE_API_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        source: "apollo",
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        error: "Apollo API service is unavailable",
      },
      { status: 503 }
    );
  }
}
