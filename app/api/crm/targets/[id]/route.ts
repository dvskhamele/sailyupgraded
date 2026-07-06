import { NextRequest, NextResponse } from "next/server";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { FIELD_MAP } from "@/lib/enrichment/presets/target-fields";
import { runWithOrganizationContext } from "@/lib/organization-context";


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = await requireOrganizationId();

  const { enrichmentFields } = await request.json();
  if (!enrichmentFields || typeof enrichmentFields !== "object") {
    return NextResponse.json({ error: "enrichmentFields required" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(enrichmentFields)) {
    const column = FIELD_MAP[key];
    if (column) updates[column] = String(value);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  return runWithOrganizationContext(organizationId, async () => {
    // Verify target exists for this organization first
    const existing = await prismadb.crm_Targets.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const target = await prismadb.crm_Targets.update({
      where: { id },
      data: { ...updates, updatedBy: session.user.id },
      select: { id: true },
    });

    return NextResponse.json({ success: true, id: target.id });
  });
}
