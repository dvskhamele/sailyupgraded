"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";

export const deleteLead = async (leadId: string) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  if (!leadId) return { error: "leadId is required" };

  try {
    await prismadb.crm_Leads.update({
      where: { id: leadId },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });
    await writeAuditLog({
      entityType: "lead",
      entityId: leadId,
      action: "deleted",
      changes: null,
      userId: session.user.id,
    });
    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    return { success: true };
  } catch (error) {
    console.log("[DELETE_LEAD]", error);
    return { error: "Failed to delete lead" };
  }
};

export const bulkDeleteLeads = async (leadIds: string[]) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(leadIds.filter(Boolean)));
  if (ids.length === 0) return { error: "At least one lead is required" };

  try {
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (leads.length === 0) return { error: "No leads found" };

    await prismadb.crm_Leads.updateMany({
      where: { id: { in: leads.map((lead) => lead.id) } },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });

    await Promise.all(
      leads.map((lead) =>
        writeAuditLog({
          entityType: "lead",
          entityId: lead.id,
          action: "deleted",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    return { success: true, count: leads.length };
  } catch (error) {
    console.log("[BULK_DELETE_LEADS]", error);
    return { error: "Failed to delete leads" };
  }
};
