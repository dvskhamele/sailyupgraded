"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

const ENTITY_SLUGS: Record<string, string> = {
  account: "accounts",
  contact: "contacts",
  lead: "leads",
  opportunity: "opportunities",
  contract: "contracts",
};

export const deleteRetailAIActivity = async (activityId: string) => {
  try {
    const session = await getSession();
    if (!session) return { error: "Unauthorized" };

    const links = await (prismadb as any).crm_RetailAIActivityLinks.findMany({
      where: { activityId },
    });

    await (prismadb as any).crm_RetailAIActivities.update({
      where: { id: activityId },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });

    for (const link of links) {
      revalidatePath(
        `/[locale]/(routes)/crm/${ENTITY_SLUGS[link.entityType] ?? `${link.entityType}s`}/${link.entityId}`,
        "page",
      );
    }
    revalidatePath("/[locale]/(routes)/retail-ai-activities", "page");

    return { success: true };
  } catch (error) {
    console.error("deleteRetailAIActivity error:", error);
    return { error: "Failed to delete Retail AI activity" };
  }
};
