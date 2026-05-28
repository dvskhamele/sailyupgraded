import { prismadb } from "@/lib/prisma";
import type { RetailAIActivityCreateInput } from "./types";

export async function findRetailAIActivityByConversationId(conversationId: string) {
  return prismadb.crm_RetailAIActivities.findFirst({
    where: {
      conversationId,
      deletedAt: null,
    },
    select: {
      id: true,
      conversationId: true,
    },
  });
}

export async function upsertRetailAIActivityRecord(data: RetailAIActivityCreateInput) {
  const upsertId = data.call_id || data.conversationId;
  
  console.log("[RETAIL AI REPOSITORY] Prisma upsert starting", {
    call_id: data.call_id,
    conversationId: data.conversationId,
    upsertId
  });

  if (!upsertId) {
    console.error("[RETAIL AI REPOSITORY] CRITICAL: Cannot upsert without call_id or conversationId", data);
    throw new Error("Missing unique identifier for Retail AI Activity");
  }

  const finalPayload = {
    type: data.type,
    title: data.title,
    description: data.description,
    date: data.date,
    duration: data.duration,
    outcome: data.outcome,
    status: data.status,
    metadata: data.metadata as any,
    assignedTo: data.assignedTo ?? null,
    aiSource: data.aiSource,
    aiInsights: data.aiInsights,
    aiConfidenceScore: data.aiConfidenceScore,
    aiMetadata: data.aiMetadata as any,
    retailAIPayload: data.retailAIPayload as any,
    aiStatus: data.aiStatus,
    aiGeneratedSummary: data.aiGeneratedSummary,
    transcript: data.transcript as any,
    recordingUrl: data.recordingUrl,
    publicLogUrl: data.publicLogUrl,
    conversationId: data.conversationId,
    webhookReceivedAt: data.webhookReceivedAt,
    sentiment: data.sentiment,
    callSuccessful: data.callSuccessful,
    call_id: data.call_id || data.conversationId,
    customer_name: data.customer_name,
    phone_number: data.phone_number,
    email: data.email,
    appointment_time: data.appointment_time,
    call_summary: data.call_summary,
    call_successful: data.call_successful,
    user_sentiment: data.user_sentiment,
    combined_cost: data.combined_cost,
    call_duration: data.call_duration,
    state: data.state,
    location: data.location,
    timezone: data.timezone,
    insurance_interest: data.insurance_interest,
    smoker_status: data.smoker_status,
    call_outcome: data.call_outcome,
    consultation_type: data.consultation_type,
  };

  console.log("[FINAL_DB_PAYLOAD]", finalPayload);

  try {
    // 1. Check if it exists first to log more details
    const existing = await prismadb.crm_RetailAIActivities.findFirst({
      where: {
        OR: [
          { call_id: upsertId },
          { conversationId: upsertId }
        ],
        deletedAt: null
      },
      select: { id: true, call_id: true, conversationId: true }
    });

    if (existing) {
      console.log(`[RETAIL AI REPOSITORY] Found existing record: ${existing.id} with call_id: ${existing.call_id}`);
    } else {
      console.log(`[RETAIL AI REPOSITORY] No existing record found for ID: ${upsertId}. Will create NEW.`);
    }

    const createPayload = {
      ...finalPayload,
      links: data.links.length
        ? {
            create: data.links.map((link) => ({
              entityType: link.entityType,
              entityId: link.entityId,
            })),
          }
        : undefined,
    };

    const updatePayload = {
      description: finalPayload.description ?? undefined,
      duration: finalPayload.duration ?? undefined,
      outcome: finalPayload.outcome ?? undefined,
      metadata: finalPayload.metadata,
      aiInsights: finalPayload.aiInsights ?? undefined,
      aiConfidenceScore: finalPayload.aiConfidenceScore ?? undefined,
      aiMetadata: finalPayload.aiMetadata,
      retailAIPayload: finalPayload.retailAIPayload,
      aiStatus: finalPayload.aiStatus ?? undefined,
      aiGeneratedSummary: finalPayload.aiGeneratedSummary ?? undefined,
      transcript: finalPayload.transcript,
      recordingUrl: finalPayload.recordingUrl ?? undefined,
      publicLogUrl: finalPayload.publicLogUrl ?? undefined,
      webhookReceivedAt: finalPayload.webhookReceivedAt ?? undefined,
      sentiment: finalPayload.sentiment ?? undefined,
      callSuccessful: finalPayload.callSuccessful,
      customer_name: finalPayload.customer_name ?? undefined,
      phone_number: finalPayload.phone_number ?? undefined,
      email: finalPayload.email ?? undefined,
      appointment_time: finalPayload.appointment_time ?? undefined,
      call_summary: finalPayload.call_summary ?? undefined,
      call_successful: finalPayload.call_successful ?? undefined,
      user_sentiment: finalPayload.user_sentiment ?? undefined,
      combined_cost: finalPayload.combined_cost ?? undefined,
      call_duration: finalPayload.call_duration ?? undefined,
      state: finalPayload.state ?? undefined,
      location: finalPayload.location ?? undefined,
      timezone: finalPayload.timezone ?? undefined,
      insurance_interest: finalPayload.insurance_interest ?? undefined,
      smoker_status: finalPayload.smoker_status ?? undefined,
      call_outcome: finalPayload.call_outcome ?? undefined,
      consultation_type: finalPayload.consultation_type ?? undefined,
    };

    const activity = existing
      ? await prismadb.crm_RetailAIActivities.update({
          where: { id: existing.id },
          data: updatePayload,
          include: {
            links: { select: { id: true, entityType: true, entityId: true } },
          },
        })
      : await prismadb.crm_RetailAIActivities.upsert({
          where: { call_id: upsertId },
          create: createPayload,
          update: updatePayload,
          include: {
            links: { select: { id: true, entityType: true, entityId: true } },
          },
        });

    console.log("[RETAIL AI REPOSITORY] Prisma upsert success", {
      activity_id: activity.id,
      call_id: upsertId,
      was_created: !existing
    });

    return activity;
  } catch (error: any) {
    console.error("[RETAIL AI REPOSITORY] Prisma upsert failure CRITICAL", {
      call_id: upsertId,
      error_message: error.message,
      error_code: error.code,
      stack: error.stack,
    });
    throw error;
  }
}

export async function createRetailAIActivityRecord(data: RetailAIActivityCreateInput) {
  return upsertRetailAIActivityRecord(data);
}
