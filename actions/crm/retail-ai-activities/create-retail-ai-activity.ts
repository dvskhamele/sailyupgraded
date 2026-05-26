"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { generateActivityTitle } from "@/lib/crm/activity-title";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { withActivityContactLink } from "@/actions/crm/activities/activity-contact-links";
import type { RetailAIActivityInput, RetailAIActivityWithLinks } from "./types";

const ENTITY_SLUGS: Record<string, string> = {
  account: "accounts",
  contact: "contacts",
  lead: "leads",
  opportunity: "opportunities",
  contract: "contracts",
};

export const createRetailAIActivity = async (data: RetailAIActivityInput & { overrideCreatedBy?: string }) => {
  try {
    const session = await getSession();
    const createdBy = data.overrideCreatedBy || session?.user?.id;

    if (!createdBy) return { error: "Unauthorized" };

    const title = generateActivityTitle({
      type: data.type,
      title: data.title,
      description: data.description,
      outcome: data.outcome,
      note: data.description,
    });

    const activity = await prismadb.$transaction(async (tx) => {
      const created = await (tx as any).crm_RetailAIActivities.create({
        data: {
          type: data.type,
          title,
          description: data.description?.trim() || null,
          date: data.date ?? new Date(),
          duration: data.duration,
          outcome: data.outcome,
          status: data.status,
          metadata: data.metadata,
          assignedTo: data.assignedTo || null,
          aiSource: data.aiSource?.trim() || null,
          aiInsights: data.aiInsights?.trim() || null,
          aiConfidenceScore: data.aiConfidenceScore ?? null,
          aiMetadata: data.aiMetadata ?? undefined,
          retailAIPayload: data.retailAIPayload ?? undefined,
          aiStatus: data.aiStatus?.trim() || null,
          aiGeneratedSummary: data.aiGeneratedSummary?.trim() || null,
          transcript: data.transcript ?? undefined,
          recordingUrl: data.recordingUrl ?? null,
          publicLogUrl: data.publicLogUrl ?? null,
          conversationId: data.conversationId ?? null,
          webhookReceivedAt: data.webhookReceivedAt ?? null,
          sentiment: data.sentiment ?? null,
          callSuccessful: data.callSuccessful ?? null,
          
          // New Fields
          call_id: data.call_id ?? null,
          customer_name: data.customer_name ?? null,
          phone_number: data.phone_number ?? null,
          email: data.email ?? null,
          appointment_time: data.appointment_time ?? null,
          call_summary: data.call_summary ?? null,
          call_successful: data.call_successful ?? null,
          user_sentiment: data.user_sentiment ?? null,
          combined_cost: data.combined_cost ?? null,
          call_duration: data.call_duration ?? null,
          
          // Additional Extraction Fields
          state: data.state ?? null,
          location: data.location ?? null,
          timezone: data.timezone ?? null,
          insurance_interest: data.insurance_interest ?? null,
          smoker_status: data.smoker_status ?? null,
          call_outcome: data.call_outcome ?? null,
          consultation_type: data.consultation_type ?? null,

          createdBy: createdBy,
        },
      });

      if (data.links.length > 0) {
        await (tx as any).crm_RetailAIActivityLinks.createMany({
          data: data.links.map((link) => ({
            activityId: created.id,
            entityType: link.entityType,
            entityId: link.entityId,
          })),
        });
      }

      return created;
    });

    const fullActivity = await (prismadb as any).crm_RetailAIActivities.findUnique({
      where: { id: activity.id },
      include: {
        created_by_user: { select: { id: true, name: true, avatar: true } },
        assigned_to_user: { select: { id: true, name: true, avatar: true } },
        links: { select: { id: true, entityType: true, entityId: true } },
      },
    });

    for (const link of data.links) {
      revalidatePath(
        `/[locale]/(routes)/crm/${ENTITY_SLUGS[link.entityType] ?? `${link.entityType}s`}/${link.entityId}`,
        "page",
      );
    }
    revalidatePath("/[locale]/(routes)/retail-ai-activities", "page");

    return {
      data: (await withActivityContactLink(
        prismadb,
        serializeDecimals(fullActivity) as RetailAIActivityWithLinks,
      )) as RetailAIActivityWithLinks,
    };
  } catch (error) {
    console.error("createRetailAIActivity error:", error);
    return { error: "Failed to create Retail AI activity" };
  }
};
