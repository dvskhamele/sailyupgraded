import type { ParsedRetailAICall } from "./parser";
import type { RetailAIActivityCreateInput } from "./types";

function truncate(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return ${trimmed.slice(0, maxLength - 1).trimEnd()}...;
}

function titleFromSummary(parsed: ParsedRetailAICall) {
  if (parsed.customer.name) {
    return truncate(parsed.customer.name, 120);
  }
  return truncate(`Retail AI Call - ${parsed.conversationId.slice(-6)}`, 120);
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
    type: "call",
    title: titleFromSummary(parsed),
    description: parsed.detailedSummary,
    date: parsed.eventTimestamp,
    duration: parsed.durationMinutes,
    outcome: parsed.summary,
    status: "completed",
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

    // New Fields mapping
    call_id: parsed.conversationId,
    customer_name: parsed.customer.name,
    phone_number: parsed.customer.phone,
    email: parsed.customer.email,
    appointment_time: parsed.appointment.date && parsed.appointment.time 
      ? new Date(${parsed.appointment.date} ) 
      : parsed.appointment.date ? new Date(parsed.appointment.date) : null,
    call_summary: parsed.summary,
    call_successful: parsed.callSuccessful ? "Successful" : "Failed",
    user_sentiment: parsed.sentiment,
    combined_cost: parsed.metrics.cost,
    call_duration: parsed.metrics.durationSeconds,

    // Additional Extraction Fields
    state: parsed.customer.state,
    location: parsed.customer.location,
    timezone: parsed.customer.timezone,
    insurance_interest: parsed.insights.insuranceInterest,
    smoker_status: parsed.insights.smokerStatus,
    call_outcome: parsed.appointment.outcome,
    consultation_type: parsed.appointment.consultationType,
  };
}
