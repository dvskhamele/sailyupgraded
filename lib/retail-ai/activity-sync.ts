type RetailAIActivityForSync = {
  id: string;
  title: string;
  description?: string | null;
  date: Date;
  duration?: number | null;
  outcome?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  customer_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  appointment_time?: Date | null;
  links?: Array<{ entityType: string; entityId: string }>;
};

export async function createActivityFromRetailAIActivity(
  prismaClient: any,
  retailAIActivity: RetailAIActivityForSync,
) {
  console.log("[ACTIVITY SYNC] Starting");
  console.log("[ACTIVITY SYNC] Retail AI ID", {
    retailAIActivityId: retailAIActivity.id,
  });

  try {
    const existingActivity = await prismaClient.crm_Activities.findFirst({
      where: {
        deletedAt: null,
        metadata: {
          path: "$.retailAI.activityId",
          equals: retailAIActivity.id,
        },
      },
      select: { id: true },
    });

    if (existingActivity) {
      console.log("[ACTIVITY SYNC] Activity created", {
        activityId: existingActivity.id,
        retailAIActivityId: retailAIActivity.id,
        alreadyExisted: true,
      });
      return existingActivity;
    }

    const scheduledMeetingTime = retailAIActivity.appointment_time ?? null;

    console.log("[ACTIVITY SYNC] Creating crm_Activities row", {
      retailAIActivityId: retailAIActivity.id,
      scheduledMeetingTime: scheduledMeetingTime?.toISOString() ?? null,
    });

    const activity = await prismaClient.crm_Activities.create({
      data: {
        type: "meeting",
        title: retailAIActivity.title,
        description: retailAIActivity.description?.trim() || null,
        date: scheduledMeetingTime ?? retailAIActivity.date,
        duration: retailAIActivity.duration ?? null,
        outcome: retailAIActivity.outcome ?? null,
        status: "scheduled",
        assignedTo: retailAIActivity.assignedTo ?? null,
        createdBy: retailAIActivity.createdBy ?? null,
        metadata: {
          source: "retail-ai",
          retailAI: {
            activityId: retailAIActivity.id,
            customerName: retailAIActivity.customer_name ?? null,
            customerEmail: retailAIActivity.email ?? null,
            customerPhone: retailAIActivity.phone_number ?? null,
            scheduledMeetingTime: scheduledMeetingTime?.toISOString() ?? null,
          },
        },
      },
    });

    if (retailAIActivity.links?.length) {
      await prismaClient.crm_ActivityLinks.createMany({
        data: retailAIActivity.links.map((link) => ({
          activityId: activity.id,
          entityType: link.entityType,
          entityId: link.entityId,
        })),
      });
    }

    console.log("[ACTIVITY SYNC] Activity created", {
      activityId: activity.id,
      retailAIActivityId: retailAIActivity.id,
    });

    return activity;
  } catch (error) {
    console.error("[ACTIVITY SYNC] Error", {
      retailAIActivityId: retailAIActivity.id,
      error,
    });
    throw error;
  }
}
