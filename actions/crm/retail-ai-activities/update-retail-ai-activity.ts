"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { generateActivityTitle } from "@/lib/crm/activity-title";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { withActivityContactLink } from "@/actions/crm/activities/activity-contact-links";
import type {
  RetailAIActivityUpdateInput,
  RetailAIActivityWithLinks,
} from "./types";

const ENTITY_SLUGS: Record<string, string> = {
  account: "accounts",
  contact: "contacts",
  lead: "leads",
  opportunity: "opportunities",
  contract: "contracts",
};

export const updateRetailAIActivity = async (data: RetailAIActivityUpdateInput) => {
  try {
    const session = await getSession();
    if (!session) return { error: "Unauthorized" };

    const existingLinks = await (prismadb as any).crm_RetailAIActivityLinks.findMany({
      where: { activityId: data.id },
    });
    const existingActivity = await (prismadb as any).crm_RetailAIActivities.findUnique({
      where: { id: data.id },
    });

    if (!existingActivity) return { error: "Retail AI activity not found" };

    const title =
      data.title !== undefined || data.description !== undefined || data.outcome !== undefined
        ? generateActivityTitle({
            type: existingActivity.type,
            title: data.title ?? existingActivity.title,
            description: data.description ?? existingActivity.description,
            outcome: data.outcome ?? existingActivity.outcome,
            note: data.description ?? existingActivity.description,
          })
        : undefined;

    const activity = await prismadb.$transaction(async (tx) => {
      const updated = await (tx as any).crm_RetailAIActivities.update({
        where: { id: data.id },
        data: {
          ...(title !== undefined && { title }),
          ...(data.description !== undefined && {
            description: data.description?.trim() || null,
          }),
          ...(data.date !== undefined && { date: data.date }),
          ...(data.duration !== undefined && { duration: data.duration }),
          ...(data.outcome !== undefined && { outcome: data.outcome }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.metadata !== undefined && { metadata: data.metadata }),
          ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo || null }),
          ...(data.aiSource !== undefined && { aiSource: data.aiSource?.trim() || null }),
          ...(data.aiInsights !== undefined && { aiInsights: data.aiInsights?.trim() || null }),
          ...(data.aiConfidenceScore !== undefined && {
            aiConfidenceScore: data.aiConfidenceScore,
          }),
          ...(data.aiMetadata !== undefined && { aiMetadata: data.aiMetadata }),
          ...(data.retailAIPayload !== undefined && {
            retailAIPayload: data.retailAIPayload,
          }),
          ...(data.aiStatus !== undefined && { aiStatus: data.aiStatus?.trim() || null }),
          ...(data.aiGeneratedSummary !== undefined && {
            aiGeneratedSummary: data.aiGeneratedSummary?.trim() || null,
          }),
          ...(data.transcript !== undefined && { transcript: data.transcript }),
          ...(data.recordingUrl !== undefined && { recordingUrl: data.recordingUrl }),
          ...(data.publicLogUrl !== undefined && { publicLogUrl: data.publicLogUrl }),
          ...(data.conversationId !== undefined && { conversationId: data.conversationId }),
          ...(data.webhookReceivedAt !== undefined && { webhookReceivedAt: data.webhookReceivedAt }),
          ...(data.sentiment !== undefined && { sentiment: data.sentiment }),
          ...(data.callSuccessful !== undefined && { callSuccessful: data.callSuccessful }),

          // New Fields
          ...(data.call_id !== undefined && { call_id: data.call_id }),
          ...(data.customer_name !== undefined && { customer_name: data.customer_name }),
          ...(data.phone_number !== undefined && { phone_number: data.phone_number }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.appointment_time !== undefined && { appointment_time: data.appointment_time }),
          ...(data.call_summary !== undefined && { call_summary: data.call_summary }),
          ...(data.call_successful !== undefined && { call_successful: data.call_successful }),
          ...(data.user_sentiment !== undefined && { user_sentiment: data.user_sentiment }),
          ...(data.combined_cost !== undefined && { combined_cost: data.combined_cost }),
          ...(data.call_duration !== undefined && { call_duration: data.call_duration }),
          
          // Additional Extraction Fields
          ...(data.state !== undefined && { state: data.state }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.timezone !== undefined && { timezone: data.timezone }),
          ...(data.insurance_interest !== undefined && { insurance_interest: data.insurance_interest }),
          ...(data.smoker_status !== undefined && { smoker_status: data.smoker_status }),
          ...(data.call_outcome !== undefined && { call_outcome: data.call_outcome }),
          ...(data.consultation_type !== undefined && { consultation_type: data.consultation_type }),

          updatedBy: session.user.id,
        },
      });

      if (data.links !== undefined) {
        await (tx as any).crm_RetailAIActivityLinks.deleteMany({
          where: { activityId: data.id },
        });
        if (data.links.length > 0) {
          await (tx as any).crm_RetailAIActivityLinks.createMany({
            data: data.links.map((link) => ({
              activityId: data.id,
              entityType: link.entityType,
              entityId: link.entityId,
            })),
          });
        }
      }

      return updated;
    });

    const allLinks = [
      ...existingLinks,
      ...(data.links ?? []).map((link) => ({
        entityType: link.entityType,
        entityId: link.entityId,
      })),
    ];
    const seen = new Set<string>();
    for (const link of allLinks) {
      const key = `${link.entityType}:${link.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      revalidatePath(
        `/[locale]/(routes)/crm/${ENTITY_SLUGS[link.entityType] ?? `${link.entityType}s`}/${link.entityId}`,
        "page",
      );
    }
    revalidatePath("/[locale]/(routes)/retail-ai-activities", "page");

    const fullActivity = await (prismadb as any).crm_RetailAIActivities.findUnique({
      where: { id: activity.id },
      include: {
        created_by_user: { select: { id: true, name: true, avatar: true } },
        assigned_to_user: { select: { id: true, name: true, avatar: true } },
        links: { select: { id: true, entityType: true, entityId: true } },
      },
    });

    return {
      data: (await withActivityContactLink(
        prismadb,
        serializeDecimals(fullActivity) as RetailAIActivityWithLinks,
      )) as RetailAIActivityWithLinks,
    };
  } catch (error) {
    console.error("updateRetailAIActivity error:", error);
    return { error: "Failed to update Retail AI activity" };
  }
};
