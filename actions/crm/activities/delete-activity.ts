"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const ENTITY_SLUGS: Record<string, string> = {
  account: "accounts",
  contact: "contacts",
  lead: "leads",
  opportunity: "opportunities",
  contract: "contracts",
};

export const deleteActivity = async (activityId: string) => {
  try {
    const session = await getSession();
    if (!session) return { error: "Unauthorized" };

    // Fetch links BEFORE deleting so we can revalidate after cascade
    const links = await (prismadb as any).crm_ActivityLinks.findMany({
      where: { activityId },
    });

    await (prismadb as any).crm_Activities.update({
      where: { id: activityId },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });

    // Activity is soft-deleted; links remain for audit trail. Revalidate captured pages.
    for (const link of links) {
      revalidatePath(
        `/[locale]/(routes)/crm/${ENTITY_SLUGS[link.entityType] ?? `${link.entityType}s`}/${link.entityId}`,
        "page"
      );
    }

    return { success: true };
  } catch (error) {
    console.error("deleteActivity error:", error);
    return { error: "Failed to delete activity" };
  }
};

export const bulkDeleteActivities = async (activityIds: string[]) => {
  try {
    const session = await getSession();
    if (!session) return { error: "Unauthorized" };

    const ids = Array.from(new Set(activityIds.filter(Boolean)));
    if (ids.length === 0) return { error: "At least one activity is required" };

    // Fetch links BEFORE deleting so we can revalidate after cascade
    const allLinks = await (prismadb as any).crm_ActivityLinks.findMany({
      where: { activityId: { in: ids } },
    });

    await (prismadb as any).crm_Activities.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });

    // Revalidate all captured pages
    const revalidatedPaths = new Set<string>();
    for (const link of allLinks) {
      const path = `/[locale]/(routes)/crm/${ENTITY_SLUGS[link.entityType] ?? `${link.entityType}s`}/${link.entityId}`;
      if (!revalidatedPaths.has(path)) {
        revalidatePath(path, "page");
        revalidatedPaths.add(path);
      }
    }
    revalidatePath("/[locale]/(routes)/activities", "page");

    return { success: true, count: ids.length };
  } catch (error) {
    console.error("bulkDeleteActivities error:", error);
    return { error: "Failed to delete activities" };
  }
};
