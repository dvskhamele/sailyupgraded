import type { ParsedRetailAICall } from "./parser";
import type { RetailAIActivityCreateInput } from "./types";

function truncate(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`;
}

function titleFromSummary(parsed: ParsedRetailAICall) {
  if (parsed.appointment.booked) {
    return truncate(
      parsed.appointment.type
        ? `${parsed.appointment.type} appointment booked`
        : "Retail AI appointment booked",
      120,
    );
  }

  return truncate(parsed.summary || "Retail AI conversation completed", 120);
}

export function mapParsedRetailAICallToActivity(
  parsed: ParsedRetailAICall,
  options: {
    contactId?: string;
    assignedTo?: string | null;
    receivedAt?: Date;
  } = {},
): RetailAIActivityCreateInput {
  const links = options.contactId
    ? [{ entityType: "contact", entityId: options.contactId }]
    : [];

  return {
    type: "meeting",
    title: titleFromSummary(parsed),
    description: parsed.detailedSummary,
    date: parsed.eventTimestamp,
    duration: parsed.durationMinutes,
    outcome: parsed.summary,
    status: parsed.appointment.booked ? "scheduled" : "completed",
    metadata: {
      recordingUrl: parsed.recordingUrl,
      publicLogUrl: parsed.publicLogUrl,
      userSentiment: parsed.sentiment,
      callCost: parsed.metrics.cost,
      transcript: parsed.transcriptJson.length > 0 ? parsed.transcriptJson : parsed.transcript,
      customer: parsed.customer,
      appointment: parsed.appointment,
    },
    aiSource: "Retell AI",
    aiStatus: parsed.callSuccessful ? "accepted" : "reviewed",
    aiConfidenceScore: parsed.confidenceScore,
    aiGeneratedSummary: parsed.summary,
    aiInsights: parsed.detailedSummary,
    aiMetadata: {
      latency: parsed.metrics.latency,
      sentiment: parsed.sentiment,
      analysis: parsed.analysis,
      callCost: parsed.metrics.cost,
      tokenUsage: parsed.metrics.tokenUsage,
      insights: parsed.insights,
      startedAt: parsed.startedAt?.toISOString(),
      endedAt: parsed.endedAt?.toISOString(),
    },
    retailAIPayload: parsed.rawPayload,
    transcript: parsed.transcriptJson.length > 0 ? parsed.transcriptJson : parsed.transcript,
    recordingUrl: parsed.recordingUrl ?? null,
    publicLogUrl: parsed.publicLogUrl ?? null,
    conversationId: parsed.conversationId,
    webhookReceivedAt: options.receivedAt ?? new Date(),
    sentiment: parsed.sentiment ?? null,
    callSuccessful: parsed.callSuccessful,
    assignedTo: options.assignedTo ?? null,
    links,
  };
}
