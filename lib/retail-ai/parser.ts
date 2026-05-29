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
  call_cost?: number | { combined_cost?: number; [key: string]: unknown };
  recording_url?: string;
  public_log_url?: string;
  total_duration_seconds?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface RetailAICallPayload {
  call_id?: string;
  id?: string;
  type?: string;
  call_type?: string;
  direction?: string;
  call_status?: string;
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
  call_cost?: number | { combined_cost?: number; [key: string]: unknown };
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
  customer_name?: string;
  user_name?: string;
  userName?: string;
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
    state?: string;
    location?: string;
  };
  appointment: {
    booked: boolean;
    date?: string;
    time?: string;
    appointmentTime?: Date;
    type?: string;
    consultationType?: string;
    outcome?: string;
  };
  metrics: {
    latency?: unknown;
    tokenUsage?: unknown;
    cost?: number;
    durationSeconds?: number;
  };
  insights: {
    intent?: string;
    urgency?: string;
    products: string[];
    followUpRequired: boolean;
    conversionProbability: number;
    insuranceInterest?: string;
    smokerStatus?: string;
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
  return sentiment.toLowerCase();
}

function inferSentiment(transcript: string): string | undefined {
  if (/\b(great|perfect|thank you|thanks|interested|book|appointment|confirmed)\b/i.test(transcript)) {
    return "positive";
  }

  if (/\b(not interested|stop calling|angry|upset|bad|terrible|no thanks)\b/i.test(transcript)) {
    return "negative";
  }

  return undefined;
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

function extractEmail(transcript: string): string | undefined {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = transcript.match(emailRegex);
  return matches ? matches[0] : undefined;
}

function extractPhone(transcript: string): string | undefined {
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = transcript.match(phoneRegex);
  return matches ? matches[0].replace(/[-.\s()]/g, "") : undefined;
}

type NameCandidate = {
  name: string;
  source: string;
  role: "user";
  segment: string;
  priority: number;
  order: number;
};

type RejectedNameCandidate = NameCandidate & {
  reason: string;
};

function normalizeRole(role: string | undefined) {
  const normalized = role?.toLowerCase();
  if (normalized === "agent" || normalized === "assistant" || normalized === "ai") return "agent";
  if (normalized === "user" || normalized === "customer" || normalized === "human") return "user";
  return undefined;
}

function cleanNameCandidate(value: string) {
  return value
    .replace(/\s+\b(?:and|from|calling|speaking|with|for|about|because|but|so)\b.*$/i, "")
    .replace(/^[\s"'`.,:;!?-]+|[\s"'`.,:;!?-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKnownAgentNames(...values: unknown[]) {
  const names = new Set<string>();
  const add = (value: unknown) => {
    const text = stringValue(value);
    if (!text) return;
    const cleaned = cleanNameCandidate(text).toLowerCase();
    if (cleaned) names.add(cleaned);
  };

  for (const value of values) {
    add(value);
  }

  return names;
}

function transcriptUserMessages(
  transcriptJson: RetailAITranscriptMessage[],
  transcript: string,
): Array<{ content: string; source: string }> {
  const structuredMessages = transcriptJson
    .filter((message) => normalizeRole(message.role) === "user")
    .map((message) => ({
      content: message.content ?? message.text ?? "",
      source: "user transcript message",
    }))
    .filter((message) => message.content.trim());

  if (structuredMessages.length > 0) return structuredMessages;

  const messages: Array<{ content: string; source: string }> = [];
  const taggedUserPattern = /(?:^|\n|\b)(?:User|Customer|Human|\[Customer\])\s*:?\s*([\s\S]*?)(?=(?:\n|\b)(?:Agent|Assistant|AI Agent|User|Customer|Human|\[AI Agent\]|\[Customer\])\s*:|$)/gi;
  for (const match of transcript.matchAll(taggedUserPattern)) {
    const content = match[1]?.trim();
    if (content) {
      messages.push({ content, source: "tagged user transcript text" });
    }
  }

  return messages;
}

function extractName(
  transcriptJson: RetailAITranscriptMessage[],
  transcript: string,
  knownAgentNames: Set<string>,
): string | undefined {
  const invalidNames = new Set([
    "agent", "ai", "assistant", "bot", "caller", "customer", "user", "human",
    "rita", "retail", "retell", "voice", "voicebot", "voice bot", "ai agent",
    "ontario", "covering", "final", "um", "life", "insurance", "financial",
    "insurance interests", "province", "state", "keywords", "generated",
    "titles", "topics", "ontario life", "covering final", "wanted",
    "consultation", "long term", "whole life", "gmail", "sunday", "california",
    "bluetide financial", "unknown", "unknown caller", "available", "interested",
    "busy", "calling", "speaking", "talking", "looking", "trying",
    "evening", "morning", "afternoon", "night", "hello", "hi", "hey",
    "good evening", "good morning", "good afternoon", "good night",
  ]);
  const invalidPhrases = [
    "insurance", "ontario", "covering", "life", "final", "policy", "financial",
    "bluetide", "assistant", "agent", "bot", "retell", "retail ai", "ai ",
    "call", "appointment",
  ];
  const candidates: NameCandidate[] = [];
  const rejected: RejectedNameCandidate[] = [];

  const addCandidate = (
    name: string | undefined,
    source: string,
    segment: string,
    priority: number,
    order: number,
  ) => {
    if (!name) return;
    candidates.push({
      name: cleanNameCandidate(name),
      source,
      role: "user",
      segment: segment.slice(0, 180),
      priority,
      order,
    });
  };

  const reject = (candidate: NameCandidate, reason: string) => {
    rejected.push({ ...candidate, reason });
  };

  const validate = (candidate: NameCandidate) => {
    const trimmed = cleanNameCandidate(candidate.name);
    const lower = trimmed.toLowerCase();
    const words = trimmed.split(/\s+/).filter(Boolean);

    if (!trimmed) return reject(candidate, "empty");
    if (/\S+@\S+\.\S+/.test(trimmed)) return reject(candidate, "email-like text");
    if (/\b(?:at|dot)\b/i.test(trimmed)) return reject(candidate, "spoken email-like text");
    if (/\d/.test(trimmed)) return reject(candidate, "contains numbers");
    if (!/^[a-zA-Z][a-zA-Z' -]*$/.test(trimmed)) return reject(candidate, "contains punctuation or non-name characters");
    if (words.some((word) => !/^[A-Z][a-zA-Z'-]*$/.test(word))) return reject(candidate, "not title-cased like a name");
    if (words.length > 2) return reject(candidate, "too many words");
    if (words.some((word) => word.length < 2)) return reject(candidate, "word too short");
    if (invalidNames.has(lower)) return reject(candidate, "known non-customer name");
    if (knownAgentNames.has(lower)) return reject(candidate, "matches known agent name");
    if (invalidPhrases.some((phrase) => lower.includes(phrase))) return reject(candidate, "contains assistant/business phrase");
    if (/^(this|that|there|okay|ok|yes|yeah|no|name|speaking|calling|with|from)$/i.test(trimmed)) {
      return reject(candidate, "conversation filler");
    }

    return { ...candidate, name: trimmed };
  };

  const userPatterns: Array<{ pattern: RegExp; source: string; priority: number }> = [
    { pattern: /\b(?:my name is|my name's|name is|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,1})\b/gi, source: "my name is statement", priority: 1 },
    { pattern: /\bi am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,1})\b/gi, source: "i am statement", priority: 2 },
    { pattern: /\b(?:i'm|i m)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,1})\b/gi, source: "i'm statement", priority: 3 },
    { pattern: /^\s*([A-Z][a-z]+)\s+(?:at|@)\s+[a-z0-9._%+-]+(?:\s+dot\s+|\.)[a-z]{2,}\b/gi, source: "user name before email", priority: 4 },
    { pattern: /^\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,1})\s*\.?\s*$/g, source: "direct user name reply", priority: 5 },
  ];

  transcriptUserMessages(transcriptJson, transcript).forEach((message, index) => {
    const content = message.content;
    for (const { pattern, source, priority } of userPatterns) {
      for (const match of content.matchAll(pattern)) {
        addCandidate(match[1], `${message.source}: ${source}`, content, priority, index);
      }
    }
  });

  const selected = candidates
    .map(validate)
    .filter(Boolean)
    .sort((a, b) => a!.order - b!.order || a!.priority - b!.priority)[0];

  console.log("[CUSTOMER NAME EXTRACTION]", {
    detectedCandidates: candidates.map((candidate) => ({
      name: candidate.name,
      source: candidate.source,
      role: candidate.role,
      priority: candidate.priority,
      order: candidate.order,
      segment: candidate.segment,
    })),
    rejectedCandidates: rejected.map((candidate) => ({
      name: candidate.name,
      source: candidate.source,
      role: candidate.role,
      reason: candidate.reason,
      segment: candidate.segment,
    })),
    finalSelectedCustomerName: selected?.name ?? null,
    exactTranscriptMessageUsed: selected?.segment ?? null,
    transcriptSegmentSource: selected
      ? {
          source: selected.source,
          role: selected.role,
          segment: selected.segment,
        }
      : null,
  });

  return selected?.name;
}

function extractTimezone(transcript: string): string | undefined {
  if (/eastern/i.test(transcript)) return "Eastern Time";
  if (/pacific/i.test(transcript)) return "Pacific Time";
  if (/central/i.test(transcript)) return "Central Time";
  if (/mountain/i.test(transcript)) return "Mountain Time";
  return undefined;
}

function extractInsuranceInterest(transcript: string): string | undefined {
  if (/life insurance/i.test(transcript)) return "life insurance";
  if (/health insurance/i.test(transcript)) return "health insurance";
  if (/auto insurance/i.test(transcript)) return "auto insurance";
  return undefined;
}

function extractSmokerStatus(transcript: string): string | undefined {
  if (/i smoke/i.test(transcript)) return "Smoker";
  if (/non-smoker/i.test(transcript) || /i don't smoke/i.test(transcript)) return "Non-Smoker";
  return "Unknown";
}

export function validateRetailAIPayload(payload: unknown): payload is RetailAIPayload {
  if (!payload || typeof payload !== "object") {
    console.error("[RETAIL AI PARSER] Validation failed: payload is null or not an object", typeof payload);
    return false;
  }
  const root = payload as RetailAIPayload;
  const call = asObject(root.call);
  
  const callId = firstString(
    call.call_id,
    call.id,
    (payload as Record<string, unknown>).call_id,
    (payload as Record<string, unknown>).conversation_id,
    (payload as Record<string, unknown>).conversationId,
  );

  if (!callId) {
    console.error("[RETAIL AI PARSER] Validation failed: No call identifier found in payload.");
    console.error("[RETAIL AI PARSER] Payload keys:", Object.keys(root));
    if (root.call) console.error("[RETAIL AI PARSER] Payload.call keys:", Object.keys(call));
  }

  return Boolean(callId);
}

function parseRelativeDate(text: string, referenceDate: Date = new Date()): Date | null {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const lowerText = text.toLowerCase();
  
  // 1. Detect Day or Relative Day
  let targetDate = new Date(referenceDate);
  targetDate.setHours(0, 0, 0, 0);
  
  const dayMatch = lowerText.match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  const tomorrowMatch = lowerText.includes("tomorrow");
  const todayMatch = lowerText.includes("today");
  const nextMatch = lowerText.includes("next");

  if (tomorrowMatch) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (dayMatch) {
    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
    let daysUntil = (targetDay - referenceDate.getDay() + 7) % 7;
    
    if (nextMatch) {
      daysUntil += 7;
    } else if (daysUntil === 0 && referenceDate.getHours() >= 12) {
      daysUntil = 7; // If today and late, assume next week
    }
    
    targetDate.setDate(targetDate.getDate() + daysUntil);
  }

  // 2. Detect Time
  // Patterns: "8 PM", "8:30 AM", "at 5", "at 5:00"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const ampm = timeMatch[3]?.toLowerCase();

  if (ampm === "pm" && hours < 12) {
    hours += 12;
  } else if (ampm === "am" && hours === 12) {
    hours = 0;
  } else if (!ampm) {
    // Fallback if no AM/PM: assume 8-11 are AM, 1-7 are PM, 12 is PM
    if (hours >= 1 && hours <= 7) hours += 12;
  }

  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
}

function extractAppointmentTime(transcript: string, transcriptJson: RetailAITranscriptMessage[], referenceDate: Date): Date | null {
  // 1. Look for confirmation patterns in the transcript
  // We prefer the agent's confirmation at the end of the call
  
  const confirmationPatterns = [
    /got you down for\s*([^.?!,]+)/i,
    /set then,?\s*([^.?!,]+)/i,
    /booked for\s*([^.?!,]+)/i,
    /scheduled for\s*([^.?!,]+)/i,
    /see you\s*([^.?!,]+)/i,
    /confirmed for\s*([^.?!,]+)/i,
    /appointment (?:is|at)\s*([^.?!,]+)/i,
    /consultation (?:is|at)\s*([^.?!,]+)/i,
    /(?:tomorrow|today) at\s*(\d{1,2}(?::\d{2})?\s*[ap]m)/i,
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday) at\s*(\d{1,2}(?::\d{2})?\s*[ap]m)/i
  ];

  // Search from the end of the transcript (reverse order of messages)
  for (let i = transcriptJson.length - 1; i >= 0; i--) {
    const msg = transcriptJson[i];
    if (msg.role === "agent" || msg.role === "assistant") {
      const content = msg.content || "";
      for (const pattern of confirmationPatterns) {
        const match = content.match(pattern);
        if (match) {
          // Pass the full message content to parseRelativeDate
          const parsed = parseRelativeDate(content, referenceDate);
          if (parsed) {
            console.log("[APPOINTMENT_EXTRACTOR] Transcript appointment detected:", parsed.toISOString());
            return parsed;
          }
        }
      }
    }
  }

  // Fallback to searching the full transcript text
  for (const pattern of confirmationPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      const startIndex = Math.max(0, match.index! - 50);
      const endIndex = Math.min(transcript.length, match.index! + 100);
      const context = transcript.slice(startIndex, endIndex);
      const parsed = parseRelativeDate(context, referenceDate);
      if (parsed) {
          console.log("[APPOINTMENT_EXTRACTOR] Transcript appointment detected:", parsed.toISOString());
          return parsed;
        }
    }
  }

  return null;
}

function generateAISummary(parsed: Partial<ParsedRetailAICall>): string {
  const customerName = parsed.customer?.name || "The customer";
  const intent = parsed.insights?.intent || "insurance";
  const outcome = parsed.appointment?.booked ? `scheduled a consultation for ${parsed.appointment.date} at ${parsed.appointment.time}` : "expressed interest";
  const sentiment = parsed.sentiment?.toLowerCase() || "neutral";
  
  let summary = `${customerName} completed a Retail AI call and showed ${sentiment} sentiment regarding ${intent}. `;
  
  if (parsed.appointment?.booked) {
    summary += `They successfully booked an appointment for ${parsed.appointment.date} at ${parsed.appointment.time}.`;
  } else if (parsed.insights?.followUpRequired) {
    summary += `Follow-up is required as they were interested but didn't book.`;
  } else {
    summary += `The call ended without a specific booking.`;
  }

  return summary;
}

export function parseRetailAICall(payload: RetailAIPayload): ParsedRetailAICall {
  try {
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
    const direction = firstString(call.direction, root.direction) || "unknown";
    const callType = firstString(call.type, call.call_type, root.type, root.call_type) || "unknown";
    const callStatus = firstString(call.call_status, root.call_status) || "unknown";
    const metadata: Record<string, unknown> = {
      ...asObject(call.metadata),
      ...asObject(root.metadata),
      ...(direction ? { call_direction: direction } : {}),
      ...(callType ? { call_type: callType } : {}),
      ...(callStatus ? { call_status: callStatus } : {}),
    };
    const transcriptJson = normalizeTranscript(call.transcript_object ?? payload.transcript_object ?? payload.transcript);
    const transcript = transcriptText(call.transcript ?? payload.transcript, transcriptJson) || "";
    const sentiment = normalizeSentiment(
      analysis.user_sentiment ?? payload.user_sentiment ?? customData.user_sentiment,
    ) || inferSentiment(transcript) || "neutral";
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
    
    // 1. Appointment Extraction
    let appointmentBooked = isAppointmentBooked(customData);
    let extractedApptDate = firstString(customData.appointment_date, customData.appointmentDate, customData.meeting_date, customData.meetingDate);
    let extractedApptTime = firstString(customData.appointment_time, customData.appointmentTime, customData.meeting_time, customData.meetingTime);
    let appointmentTime: Date | undefined = undefined;

    // Try to parse from custom data if present
    if (extractedApptDate) {
      const combined = extractedApptTime ? `${extractedApptDate} ${extractedApptTime}` : extractedApptDate;
      const parsed = new Date(combined);
      if (!isNaN(parsed.getTime())) {
        appointmentTime = parsed;
      }
    }

    // Enhanced extraction from transcript if fields are missing or if booked but no time
    if (!appointmentTime) {
      const parsedAppt = extractAppointmentTime(transcript, transcriptJson, eventTimestamp);
      if (parsedAppt) {
        appointmentBooked = true;
        appointmentTime = parsedAppt;
        // Format as YYYY-MM-DD and HH:mm for the legacy fields
        extractedApptDate = parsedAppt.toISOString().split("T")[0];
        extractedApptTime = parsedAppt.toTimeString().split(" ")[0].slice(0, 5);
        console.log(`[RETELL WEBHOOK] Enhanced appointment extraction: ${extractedApptDate} ${extractedApptTime}`);
      }
    }

    // 2. Summary Extraction
    let summary = firstString(analysis.call_summary, analysis.summary) || "";
    const detailedSummary =
      firstString(customData.detailed_call_summary, customData.detailedCallSummary) || "";
    
    const knownAgentNames = extractKnownAgentNames(
      call.agent_name,
      (call as Record<string, unknown>).agentName,
      root.agent_name,
      root.agentName,
      metadata.agent_name,
      metadata.agentName,
      customData.agent_name,
      customData.agentName,
      customData.assistant_name,
      customData.assistantName,
      customData.bot_name,
      customData.botName,
    );
    console.log("[CUSTOMER NAME EXTRACTION] Skipping fallback customer-name sources", {
      reason: "Customer names must come only from user transcript messages",
      skippedSources: {
        analysis_customer_name: analysis.customer_name ?? null,
        analysis_userName: analysis.userName ?? null,
        analysis_user_name: analysis.user_name ?? null,
        customData_customer_name: customData.customer_name ?? null,
        customData_customerName: customData.customerName ?? null,
        metadata_customer_name: metadata.customer_name ?? null,
        metadata_customerName: metadata.customerName ?? null,
        summary: summary || null,
        detailedSummary: detailedSummary || null,
      },
    });
    const extractedName = extractName(
      transcriptJson,
      transcript,
      knownAgentNames,
    );
    const extractedEmail = extractEmail(transcript);
    const extractedPhone = extractPhone(transcript);
    const extractedTimezone = extractTimezone(transcript);
    const extractedInsurance = extractInsuranceInterest(transcript);
    const extractedSmoker = extractSmokerStatus(transcript);

    const getCost = () => {
      const rawCost = call.call_cost ?? payload.call_cost;
      if (typeof rawCost === "number") return rawCost;
      if (rawCost && typeof rawCost === "object" && "combined_cost" in (rawCost as any)) {
        return numberValue((rawCost as any).combined_cost);
      }
      return undefined;
    };

    const getCustomerPhone = () => {
      // 1. Check custom data/metadata first (explicitly set)
      const explicitPhone = firstString(
        customData.customer_phone,
        customData.customerPhone,
        metadata.customer_phone,
        metadata.customerPhone
      );
      if (explicitPhone) return explicitPhone;

      // 2. For phone calls, determine based on direction
      const directionVal = direction.toLowerCase();
      const fromNum = call.from_number;
      const toNum = call.to_number;

      if (fromNum && toNum) {
        if (directionVal === "inbound") {
          return fromNum; // Inbound: From customer to AI
        } else if (directionVal === "outbound") {
          return toNum; // Outbound: From AI to customer
        }
      }

      // 3. Fallback to any available number or extracted
      return firstString(fromNum, toNum, extractedPhone) || "Unknown";
    };

    const customerData = {
      name: extractedName,
      phone: getCustomerPhone(),
      email: firstString(customData.customer_email, customData.customerEmail, metadata.customer_email, metadata.customerEmail, extractedEmail),
      timezone: firstString(customData.customer_timezone, customData.customerTimezone, metadata.customer_timezone, metadata.customerTimezone, extractedTimezone),
      state: firstString(customData.state, metadata.state, customData.location, metadata.location),
      location: firstString(customData.location, metadata.location),
    };

    const insights = {
      intent: firstString(customData.customer_intent, customData.intent),
      urgency: firstString(customData.urgency),
      products: arrayOfStrings(customData.requested_products ?? customData.products),
      followUpRequired: booleanValue(customData.follow_up_required ?? customData.followUpRequired) ?? false,
      conversionProbability:
        numberValue(customData.conversion_probability ?? customData.conversionProbability) ??
        (callSuccessful ? 80 : 20),
      insuranceInterest: firstString(customData.insurance_interest, customData.insuranceInterest, extractedInsurance),
      smokerStatus: firstString(customData.smoker_status, customData.smokerStatus, extractedSmoker),
    };

    const appointment = {
       booked: appointmentBooked,
       date: extractedApptDate,
       time: extractedApptTime,
       appointmentTime,
       type: firstString(customData.appointment_type, customData.appointmentType),
       consultationType: firstString(customData.consultation_type, customData.consultationType),
       outcome: firstString(customData.call_outcome, customData.callOutcome, customData.outcome),
     };

    // If no summary was provided, generate one
    if (!summary) {
      summary = generateAISummary({
        customer: customerData,
        appointment,
        insights,
        sentiment,
      });
      console.log(`[RETELL WEBHOOK] Generated fallback summary: ${summary}`);
    }

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
      summary,
      detailedSummary,
      sentiment,
      callSuccessful,
      confidenceScore: confidenceFrom(sentiment, callSuccessful, transcript),
      customer: customerData,
      appointment,
      metrics: {
        latency: call.latency ?? payload.latency,
        tokenUsage: call.token_usage,
        cost: getCost(),
        durationSeconds: durationSeconds,
      },
      insights,
      analysis,
      metadata,
      rawPayload: payload,
    };
  } catch (error) {
    console.error("[RETAIL AI PARSER] CRITICAL FAILURE:", error);
    // Return a minimally valid object to prevent total pipeline crash
    return {
      conversationId: firstString((payload as any)?.call?.call_id, (payload as any)?.call_id) || "unknown",
      transcript: "",
      transcriptJson: [],
      eventTimestamp: new Date(),
      durationMinutes: null,
      summary: "Parsing failed",
      detailedSummary: "",
      callSuccessful: false,
      confidenceScore: 0,
      customer: { name: "Unknown Caller", phone: "Unknown" },
      appointment: { booked: false },
      metrics: {},
      insights: { products: [], followUpRequired: false, conversionProbability: 0 },
      analysis: {},
      metadata: {},
      rawPayload: payload,
    };
  }
}

export function formatTranscript(transcriptObj: RetailAITranscriptMessage[]): string {
  return transcriptText(undefined, transcriptObj);
}
