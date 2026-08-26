import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { bulkEnrichLeads } from "@/lib/leads/lead-enrichment-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let leadIds: string[] = [];

    if (Array.isArray(body.leadIds)) {
      leadIds = body.leadIds;
    } else if (Array.isArray(body.ids)) {
      leadIds = body.ids;
    } else if (typeof body.leadId === "string" && body.leadId.trim()) {
      leadIds = [body.leadId.trim()];
    } else if (typeof body.id === "string" && body.id.trim()) {
      leadIds = [body.id.trim()];
    } else if (Array.isArray(body.leads)) {
      leadIds = body.leads
        .map((l: any) => (typeof l === "string" ? l : l?.id))
        .filter(Boolean);
    }

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds must be a non-empty array of lead IDs" },
        { status: 400 }
      );
    }

    const result = await bulkEnrichLeads(leadIds, session.user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/crm/leads/enrich] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error while enriching leads" },
      { status: 500 }
    );
  }
}
