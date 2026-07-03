import { prismadb } from "@/lib/prisma";
import { requireOrganizationContext } from "@/lib/organization-context";
import { createActivityFromRetailAIActivity } from "./activity-sync";
import type { RetailAIActivityCreateInput } from "./types";

export async function findRetailAIActivityByConversationId(conversationId: string) {
  requireOrganizationContext();

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
  requireOrganizationContext();

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

  console.log("[RETAIL_AI_ACTIVITY_FINAL]", { 
    call_id: data.call_id, 
    call_summary: data.call_summary, 
    appointment_time: data.appointment_time, 
    customer_name: data.customer_name 
  });

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

    const activity = await prismadb.crm_RetailAIActivities.upsert({
      where: { call_id: upsertId },
      create: {
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
        links: data.links.length
          ? {
              create: data.links.map((link) => ({
                entityType: link.entityType,
                entityId: link.entityId,
              })),
            }
          : undefined,
      },
      update: {
        description: data.description || undefined,
        duration: data.duration || undefined,
        outcome: data.outcome || undefined,
        metadata: data.metadata as any,
        aiInsights: data.aiInsights || undefined,
        aiConfidenceScore: data.aiConfidenceScore || undefined,
        aiMetadata: data.aiMetadata as any,
        retailAIPayload: data.retailAIPayload as any,
        aiStatus: data.aiStatus || undefined,
        aiGeneratedSummary: data.aiGeneratedSummary || undefined,
        transcript: data.transcript as any,
        recordingUrl: data.recordingUrl || undefined,
        publicLogUrl: data.publicLogUrl || undefined,
        sentiment: data.sentiment || undefined,
        callSuccessful: data.callSuccessful !== undefined ? data.callSuccessful : undefined,
        customer_name: data.customer_name || undefined,
        phone_number: data.phone_number || undefined,
        email: data.email || undefined,
        appointment_time: data.appointment_time || undefined,
        call_summary: data.call_summary || undefined,
        call_successful: data.call_successful || undefined,
        user_sentiment: data.user_sentiment || undefined,
        combined_cost: data.combined_cost || undefined,
        call_duration: data.call_duration || undefined,
        state: data.state || undefined,
        location: data.location || undefined,
        timezone: data.timezone || undefined,
        insurance_interest: data.insurance_interest || undefined,
        smoker_status: data.smoker_status || undefined,
        call_outcome: data.call_outcome || undefined,
        consultation_type: data.consultation_type || undefined,
      },
      include: {
        links: { select: { id: true, entityType: true, entityId: true } },
      },
    });

    console.log("[RETAIL AI REPOSITORY] Prisma upsert success", {
      activity_id: activity.id,
      call_id: upsertId,
      was_created: !existing
    });

    const crmActivity = await createActivityFromRetailAIActivity(prismadb, {
      ...activity,
      links: activity.links.map((link) => ({
        entityType: link.entityType,
        entityId: link.entityId,
      })),
    });

    console.log("[RETAIL AI REPOSITORY] CRM activity ensured for Retail AI activity", {
      retail_ai_activity_id: activity.id,
      crm_activity_id: crmActivity.id,
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
