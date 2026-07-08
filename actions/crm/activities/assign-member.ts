"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";

export const bulkAssignActivities = async (
  activityIds: string[],
  assignedMemberId: string
) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(activityIds.filter(Boolean)));
  if (ids.length === 0)
    return { error: "At least one activity is required" };
  if (!assignedMemberId) return { error: "Assigned member is required" };

  try {
    // First verify the member exists and is active
    const member = await prismadb.users.findFirst({
      where: { id: assignedMemberId, userStatus: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!member) return { error: "Assigned member not found or inactive" };

    // Fetch activities that exist
    const activities = await prismadb.crm_Activities.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (activities.length === 0) return { error: "No activities found" };

    // Update all activities in one go
    await prismadb.crm_Activities.updateMany({
      where: { id: { in: activities.map((activity) => activity.id) } },
      data: { assignedTo: assignedMemberId },
    });

    await Promise.all(
      activities.map((activity) =>
        writeAuditLog({
          entityType: "activity",
          entityId: activity.id,
          action: "updated",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/activities", "page");
    return { success: true, count: activities.length };
  } catch (error) {
    console.log("[BULK_ASSIGN_ACTIVITIES]", error);
    return { error: "Failed to assign activities" };
  }
};
