export type RetailAITranscriptMessage = {
  role?: "agent" | "user" | "assistant" | string;
  content?: string;
  text?: string;
  words?: Array<{
    word: string;
    start_time?: number;
    end_time?: number;
  }>;
};

export interface RetailAIPayload {
  event?: string;
  event_timestamp?: string | number;
  call?: RetailAICallPayload;
  transcript?: string | RetailAITranscriptMessage[];
  transcript_object?: RetailAITranscriptMessage[];
  call_analysis?: RetailAICallAnalysis;
  user_sentiment?: string;
  call_successful?: boolean;
  latency?: unknown;
  call_cost?: number;
  recording_url?: string;
  public_log_url?: string;
  total_duration_seconds?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface RetailAICallPayload {
  call_id?: string;
  id?: string;
  transcript?: string;
  transcript_object?: RetailAITranscriptMessage[];
  call_analysis?: RetailAICallAnalysis;
  recording_url?: string;
  public_log_url?: string;
  start_timestamp?: string | number;
  end_timestamp?: string | number;
  event_timestamp?: string | number;
  duration_ms?: number;
  total_duration_seconds?: number;
  call_cost?: number;
  latency?: unknown;
  token_usage?: unknown;
  metadata?: Record<string, unknown>;
  from_number?: string;
  to_number?: string;
  [key: string]: unknown;
}

export interface RetailAICallAnalysis {
  call_summary?: string;
  summary?: string;
  user_sentiment?: string;
  call_successful?: boolean;
  custom_analysis_data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParsedRetailAICall {
  conversationId: string;
  transcript: string;
  transcriptJson: RetailAITranscriptMessage[];
  recordingUrl?: string;
  publicLogUrl?: string;
  eventTimestamp: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes: number | null;
  summary: string;
  detailedSummary: string;
  sentiment?: string;
  callSuccessful: boolean;
  confidenceScore: number;
  customer: {
    name?: string;
    phone?: string;
    email?: string;
    timezone?: string;
  };
  appointment: {
    booked: boolean;
    date?: string;
    time?: string;
    type?: string;
    consultationType?: string;
  };
  metrics: {
    latency?: unknown;
    tokenUsage?: unknown;
    cost?: number;
  };
  insights: {
    intent?: string;
    urgency?: string;
    products: string[];
    followUpRequired: boolean;
    conversionProbability: number;
  };
  analysis: RetailAICallAnalysis;
  metadata: Record<string, unknown>;
  rawPayload: RetailAIPayload;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "booked", "successful", "success"].includes(normalized)) return true;
    if (["false", "no", "not_booked", "failed", "failure"].includes(normalized)) return false;
  }
  return undefined;
}

function dateValue(value: unknown): Date | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const text = stringValue(value);
  if (!text) return undefined;
  const numeric = numberValue(text);
  if (numeric !== undefined) return dateValue(numeric);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return undefined;
}

function normalizeTranscript(value: unknown): RetailAITranscriptMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((message) => {
      const item = asObject(message);
      const content = firstString(item.content, item.text);
      return content
        ? {
            role: stringValue(item.role),
            content,
            words: Array.isArray(item.words)
              ? (item.words as RetailAITranscriptMessage["words"])
              : undefined,
          }
        : null;
    })
    .filter(Boolean) as RetailAITranscriptMessage[];
}

function transcriptText(rawTranscript: unknown, transcriptObject: RetailAITranscriptMessage[]) {
  const direct = stringValue(rawTranscript);
  if (direct) return direct;
  return transcriptObject
    .map((message) => {
      const role = message.role === "agent" || message.role === "assistant" ? "AI Agent" : "Customer";
      return `[${role}]: ${message.content}`;
    })
    .join("\n\n");
}

function normalizeSentiment(value: unknown): string | undefined {
  const sentiment = stringValue(value);
  if (!sentiment) return undefined;
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase();
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => stringValue(item)).filter(Boolean) as string[];
  }
  const text = stringValue(value);
  return text ? text.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function isAppointmentBooked(customData: Record<string, unknown>) {
  const status = firstString(
    customData.appointment_status,
    customData.appointmentStatus,
    customData.appointment_booked,
    customData.appointmentBooked,
    customData.meeting_booked,
    customData.meetingBooked,
  );
  const explicit = booleanValue(status);
  if (explicit !== undefined) return explicit;

  return Boolean(
    firstString(
      customData.appointment_date,
      customData.appointmentDate,
      customData.meeting_date,
      customData.meetingDate,
    ),
  );
}

function confidenceFrom(sentiment: string | undefined, successful: boolean, transcript: string) {
  let confidence = successful ? 75 : 45;
  const normalized = sentiment?.toLowerCase();

  if (normalized === "positive") confidence += 15;
  if (normalized === "neutral") confidence += 5;
  if (normalized === "negative") confidence -= 10;
  if (transcript.length > 500) confidence += 5;

  return Math.min(Math.max(confidence, 0), 100);
}

export function validateRetailAIPayload(payload: unknown): payload is RetailAIPayload {
  if (!payload || typeof payload !== "object") return false;
  const root = payload as RetailAIPayload;
  const call = asObject(root.call);
  return Boolean(
    firstString(
      call.call_id,
      call.id,
      (payload as Record<string, unknown>).call_id,
      (payload as Record<string, unknown>).conversation_id,
      (payload as Record<string, unknown>).conversationId,
    ),
  );
}

export function parseRetailAICall(payload: RetailAIPayload): ParsedRetailAICall {
  if (!validateRetailAIPayload(payload)) {
    throw new Error("Retail AI payload must include call.call_id or conversation id");
  }

  const root = payload as Record<string, unknown>;
  const call = asObject(payload.call) as RetailAICallPayload;
  const analysis = {
    ...asObject(payload.call_analysis),
    ...asObject(call.call_analysis),
  } as RetailAICallAnalysis;
  const customData = asObject(analysis.custom_analysis_data);
  const metadata = {
    ...asObject(call.metadata),
    ...asObject(root.metadata),
  };
  const transcriptJson = normalizeTranscript(call.transcript_object ?? payload.transcript_object ?? payload.transcript);
  const transcript = transcriptText(call.transcript ?? payload.transcript, transcriptJson);
  const sentiment = normalizeSentiment(
    analysis.user_sentiment ?? payload.user_sentiment ?? customData.user_sentiment,
  );
  const callSuccessful =
    booleanValue(analysis.call_successful) ??
    booleanValue(payload.call_successful) ??
    booleanValue(customData.call_successful) ??
    false;
  const durationSeconds =
    numberValue(call.total_duration_seconds) ??
    numberValue(payload.total_duration_seconds) ??
    undefined;
  const durationMs = numberValue(call.duration_ms) ?? numberValue(payload.duration_ms);
  const durationMinutes =
    durationSeconds !== undefined
      ? Math.round(durationSeconds / 60)
      : durationMs !== undefined
        ? Math.round(durationMs / 60_000)
        : null;
  const eventTimestamp =
    dateValue(payload.event_timestamp) ??
    dateValue(call.event_timestamp) ??
    dateValue(call.end_timestamp) ??
    dateValue(call.start_timestamp) ??
    new Date();
  const appointmentBooked = isAppointmentBooked(customData);

  return {
    conversationId:
      firstString(call.call_id, call.id, root.call_id, root.conversation_id, root.conversationId) ?? "",
    transcript,
    transcriptJson,
    recordingUrl: firstString(call.recording_url, payload.recording_url),
    publicLogUrl: firstString(call.public_log_url, payload.public_log_url),
    eventTimestamp,
    startedAt: dateValue(call.start_timestamp),
    endedAt: dateValue(call.end_timestamp),
    durationMinutes,
    summary:
      firstString(analysis.call_summary, analysis.summary, customData.call_summary) ??
      "Retail AI conversation completed",
    detailedSummary:
      firstString(
        customData.detailed_call_summary,
        customData.detailedCallSummary,
        customData.full_summary,
        analysis.call_summary,
        analysis.summary,
      ) ?? "No detailed summary available.",
    sentiment,
    callSuccessful,
    confidenceScore: confidenceFrom(sentiment, callSuccessful, transcript),
    customer: {
      name: firstString(customData.customer_name, customData.customerName, metadata.customer_name, metadata.customerName),
      phone: firstString(
        customData.customer_phone,
        customData.customerPhone,
        metadata.customer_phone,
        metadata.customerPhone,
        call.from_number,
        call.to_number,
      ),
      email: firstString(customData.customer_email, customData.customerEmail, metadata.customer_email, metadata.customerEmail),
      timezone: firstString(customData.customer_timezone, customData.customerTimezone, metadata.customer_timezone, metadata.customerTimezone),
    },
    appointment: {
      booked: appointmentBooked,
      date: firstString(customData.appointment_date, customData.appointmentDate, customData.meeting_date, customData.meetingDate),
      time: firstString(customData.appointment_time, customData.appointmentTime, customData.meeting_time, customData.meetingTime),
      type: firstString(customData.appointment_type, customData.appointmentType),
      consultationType: firstString(customData.consultation_type, customData.consultationType),
    },
    metrics: {
      latency: call.latency ?? payload.latency,
      tokenUsage: call.token_usage,
      cost: numberValue(call.call_cost) ?? numberValue(payload.call_cost),
    },
    insights: {
      intent: firstString(customData.customer_intent, customData.intent),
      urgency: firstString(customData.urgency),
      products: arrayOfStrings(customData.requested_products ?? customData.products),
      followUpRequired: booleanValue(customData.follow_up_required ?? customData.followUpRequired) ?? false,
      conversionProbability:
        numberValue(customData.conversion_probability ?? customData.conversionProbability) ??
        (callSuccessful ? 80 : 20),
    },
    analysis,
    metadata,
    rawPayload: payload,
  };
}

export function formatTranscript(transcriptObj: RetailAITranscriptMessage[]): string {
  return transcriptText(undefined, transcriptObj);
}
