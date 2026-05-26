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

export async function createRetailAIActivityRecord(data: RetailAIActivityCreateInput) {
  return prismadb.crm_RetailAIActivities.create({
    data: {
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
      
      // New Fields
      call_id: data.call_id,
      customer_name: data.customer_name,
      phone_number: data.phone_number,
      email: data.email,
      appointment_time: data.appointment_time,
      call_summary: data.call_summary,
      call_successful: data.call_successful,
      user_sentiment: data.user_sentiment,
      combined_cost: data.combined_cost,
      call_duration: data.call_duration,

      links: data.links.length
        ? {
            create: data.links.map((link) => ({
              entityType: link.entityType,
              entityId: link.entityId,
            })),
          }
        : undefined,
    },
    include: {
      links: { select: { id: true, entityType: true, entityId: true } },
    },
  });
}
