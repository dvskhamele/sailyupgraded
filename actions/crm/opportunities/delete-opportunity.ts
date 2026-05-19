"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";

export const deleteOpportunity = async (opportunityId: string) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  if (!opportunityId) return { error: "opportunityId is required" };

  try {
    await prismadb.crm_Opportunities.update({
      where: { id: opportunityId },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });
    await writeAuditLog({
      entityType: "opportunity",
      entityId: opportunityId,
      action: "deleted",
      changes: null,
      userId: session.user.id,
    });
    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");
    return { success: true };
  } catch (error) {
    console.log("[DELETE_OPPORTUNITY]", error);
    return { error: "Failed to delete opportunity" };
  }
};

export const bulkDeleteOpportunities = async (opportunityIds: string[]) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(opportunityIds.filter(Boolean)));
  if (ids.length === 0) return { error: "At least one opportunity is required" };

  try {
    const opportunities = await prismadb.crm_Opportunities.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (opportunities.length === 0) return { error: "No opportunities found" };

    await prismadb.crm_Opportunities.updateMany({
      where: { id: { in: opportunities.map((opportunity) => opportunity.id) } },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });

    await Promise.all(
      opportunities.map((opportunity) =>
        writeAuditLog({
          entityType: "opportunity",
          entityId: opportunity.id,
          action: "deleted",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");
    return { success: true, count: opportunities.length };
  } catch (error) {
    console.log("[BULK_DELETE_OPPORTUNITIES]", error);
    return { error: "Failed to delete opportunities" };
  }
};
