"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";

export const bulkAssignLeads = async (
  leadIds: string[],
  assignedMemberId: string
) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(leadIds.filter(Boolean)));
  if (ids.length === 0)
    return { error: "At least one lead is required" };
  if (!assignedMemberId) return { error: "Assigned member is required" };

  try {
    // First verify the member exists and is active
    const member = await prismadb.users.findFirst({
      where: { id: assignedMemberId, userStatus: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!member) return { error: "Assigned member not found or inactive" };

    // Fetch leads that exist
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (leads.length === 0) return { error: "No leads found" };

    // Update all leads in one go
    await prismadb.crm_Leads.updateMany({
      where: { id: { in: leads.map((lead) => lead.id) } },
      data: { assigned_to: assignedMemberId },
    });

    await Promise.all(
      leads.map((lead) =>
        writeAuditLog({
          entityType: "lead",
          entityId: lead.id,
          action: "updated",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    return { success: true, count: leads.length };
  } catch (error) {
    console.log("[BULK_ASSIGN_LEADS]", error);
    return { error: "Failed to assign leads" };
  }
};
