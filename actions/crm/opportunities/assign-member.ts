"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";

export const bulkAssignOpportunities = async (
  opportunityIds: string[],
  assignedMemberId: string
) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(opportunityIds.filter(Boolean)));
  if (ids.length === 0)
    return { error: "At least one opportunity is required" };
  if (!assignedMemberId) return { error: "Assigned member is required" };

  try {
    // First verify the member exists and is active
    const member = await prismadb.users.findFirst({
      where: { id: assignedMemberId, userStatus: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!member) return { error: "Assigned member not found or inactive" };

    // Fetch opportunities that exist
    const opportunities = await prismadb.crm_Opportunities.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (opportunities.length === 0) return { error: "No opportunities found" };

    // Update all opportunities in one go
    await prismadb.crm_Opportunities.updateMany({
      where: { id: { in: opportunities.map((opportunity) => opportunity.id) } },
      data: { assigned_to: assignedMemberId },
    });

    await Promise.all(
      opportunities.map((opportunity) =>
        writeAuditLog({
          entityType: "opportunity",
          entityId: opportunity.id,
          action: "updated",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");
    return { success: true, count: opportunities.length };
  } catch (error) {
    console.log("[BULK_ASSIGN_OPPORTUNITIES]", error);
    return { error: "Failed to assign opportunities" };
  }
};
