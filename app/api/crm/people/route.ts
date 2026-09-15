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
    // `q` is the documented Apollo /contacts search parameter. Keep `query`
    // as a backwards-compatible API alias, but always forward a single value.
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const typeParam = searchParams.get("type") || "All";
    const type = typeParam === "Account" || typeParam === "Contact" ? typeParam : "All";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
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

    console.info("[PEOPLE_SEARCH]", {
      search: query,
      page,
      limit,
      offset: (page - 1) * limit,
    });

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
      totalPages: result.totalPages ?? (typeof result.total === "number" && result.total > 0
        ? Math.ceil(result.total / (result.limit || limit))
        : undefined),
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
