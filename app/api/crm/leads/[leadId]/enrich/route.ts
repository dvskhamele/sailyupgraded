import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { bulkEnrichLeads } from "@/lib/leads/lead-enrichment-service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const { leadId } = resolvedParams;

    if (!leadId) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    const result = await bulkEnrichLeads([leadId], session.user.id);

    if (result.failedCount > 0 && result.successCount === 0) {
      return NextResponse.json(
        {
          error: result.failedLeads[0]?.error || "Failed to enrich lead",
          failedLeads: result.failedLeads,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        leadUpdated: result.leadUpdated ?? (result.successCount > 0),
        organizationUpdated: result.organizationUpdated ?? false,
        organizationCreated: result.organizationCreated ?? false,
        lead: result.lead || result.updatedLeads[0],
        organization: result.organization,
        successCount: result.successCount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[POST /api/crm/leads/[leadId]/enrich] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error while enriching lead" },
      { status: 500 }
    );
  }
}
