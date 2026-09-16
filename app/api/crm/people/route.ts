import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getUnifiedPeople } from "@/actions/crm/people/get-people";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const debugId = req.headers.get("x-people-debug-id") || `people-api-${Date.now().toString(36)}`;
    const session = await getSession();
    if (!session) {
      console.warn("[PEOPLE_API_REQUEST]", { debugId, status: 401, reason: "missing-session" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // `q` is the documented Apollo /contacts search parameter. Keep `query`
    // as a backwards-compatible API alias, but always forward a single value.
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const typeParam = searchParams.get("type") || "All";
    const type = typeParam === "Account" || typeParam === "Contact" ? typeParam : "All";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "200", 10) || 200));
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

    console.info("[PEOPLE_API_REQUEST]", {
      debugId,
      path: "/api/crm/people",
      page,
      limit,
      offset: (page - 1) * limit,
      queryPresent: Boolean(query),
      queryLength: query.length,
      filterKeys: ["country", "state", "city", "company", "jobTitle", "status", "role", "hasEmail", "hasPhone", "hasLinkedin", "hasCompany"].filter((key) => searchParams.has(key)),
    });

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
      debugId,
    });

    if (!result.success) {
      console.error("[PEOPLE_API_RESPONSE]", { debugId, status: 503, success: false, error: result.error || "Apollo unavailable" });
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

    console.info("[PEOPLE_API_RESPONSE]", { debugId, status: 200, success: true, source: result.source, records: result.data.length, total: result.total, page: result.page || page, limit: result.limit || limit });
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
        limit: 200,
        totalPages: 0,
        error: "Apollo API service is unavailable",
      },
      { status: 503 }
    );
  }
}
