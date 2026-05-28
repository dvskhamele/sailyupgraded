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
  retell_llm_dynamic_variables?: Record<string, unknown>;
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
  retell_llm_dynamic_variables?: Record<string, unknown>;
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
  const normalized = sentiment.toLowerCase();
  if (normalized.includes("positive")) return "positive";
  if (normalized.includes("negative")) return "negative";
  if (normalized.includes("neutral")) return "neutral";
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

function inferSentimentFromTranscript(transcript: string): "positive" | "neutral" | "negative" {
  const lower = transcript.toLowerCase();
  const positiveMatches = [
    "thank you",
    "thanks",
    "perfect",
    "great",
    "sounds good",
    "appreciate",
    "interested",
    "book",
    "schedule",
    "appointment",
    "yes",
  ].filter((phrase) => lower.includes(phrase)).length;
  const negativeMatches = [
    "not interested",
    "don't call",
    "do not call",
    "stop calling",
    "angry",
    "frustrated",
    "annoyed",
    "cancel",
    "no thanks",
    "no thank you",
  ].filter((phrase) => lower.includes(phrase)).length;

  if (negativeMatches > positiveMatches) return "negative";
  if (positiveMatches > 0) return "positive";
  return "neutral";
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

function extractName(detailedSummary: string, summary: string, transcript: string): string | undefined {
  const invalidNames = new Set([
    "ontario", "covering", "final", "um", "life", "insurance", "retail", "assistant", 
    "financial", "insurance interests", "province", "state", "keywords", "generated", 
    "titles", "topics", "ontario life", "covering final", "wanted", "consultation",
    "long term", "whole life", "gmail", "sunday", "california", "bluetide financial"
  ]);

  const isValid = (name: string) => {
    if (!name) return false;
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    
    // Validation Rules:
    // 1. Alphabets/spaces only
    if (!/^[a-zA-Z\s]+$/.test(trimmed)) return false;
    
    // 2. Max 3 words
    if (trimmed.split(/\s+/).length > 3) return false;
    
    // 3. Reject filler/invalid words
    if (invalidNames.has(lower)) return false;
    if (lower.length < 2) return false;
    
    const invalidPhrases = ["insurance", "ontario", "covering", "life", "final", "policy", "financial", "bluetide"];
    if (invalidPhrases.some(phrase => lower.includes(phrase))) return false;
    
    return true;
  };

  const text = `${detailedSummary}\n${summary}\n${transcript}`;
  const transcriptPatterns = [
    /the user,?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+(?:called|asked|is|was|expressed|scheduled)/i,
    /user named\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /customer(?:'s)? name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /client(?:'s)? name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /your name is ([A-Z][a-z]+)/i,
    /name as ([A-Z][a-z]+)/i,
    /this is ([A-Z][a-z]+)/i,
    /Perfect, ([A-Z][a-z]+)/i,
    /Thanks, ([A-Z][a-z]+)/i,
    /Hello ([A-Z][a-z]+)/i,
    /Hi ([A-Z][a-z]+)/i,
    /My name is ([A-Z][a-z]+)/i
  ];
  
  for (const pattern of transcriptPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && isValid(match[1])) return match[1].trim();
  }

  return undefined;
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
  const hasAppointmentContext = /(appointment|consultation|meeting|scheduled|booked|confirmed|see you|got you down|set then)/i.test(text);

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
  } else if (!todayMatch && !hasAppointmentContext) {
    return null;
  }

  // 2. Detect Time
  // Patterns: "8 PM", "8:30 AM", "at 5", "at 5:00"
  const timeMatch = text.match(/(?:\bat\s+|\bfor\s+|\s)(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\b/i);
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
  if (!dayMatch && !tomorrowMatch && !todayMatch && hasAppointmentContext && targetDate < referenceDate) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
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
    /online consultation at\s*(\d{1,2}(?::\d{2})?\s*(?:[ap]m)?)/i,
    /(?:tomorrow|today) at\s*(\d{1,2}(?::\d{2})?\s*[ap]m)/i,
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday) at\s*(\d{1,2}(?::\d{2})?\s*(?:[ap]m)?)/i
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
  
  let summary = `${customerName} showed ${sentiment} sentiment regarding ${intent}. `;
  
  if (parsed.appointment?.booked) {
    summary += `They successfully booked an appointment for ${parsed.appointment.date} at ${parsed.appointment.time}.`;
  } else if (parsed.insights?.followUpRequired) {
    summary += `Follow-up is required as they were interested but didn't book.`;
  } else {
    summary += `The call ended without a specific booking.`;
  }

  return summary;
}

function generateSummaryFromTranscript(transcript: string, customerName?: string, appointmentTime?: Date, sentiment?: string) {
  const compact = transcript.replace(/\s+/g, " ").trim();
  const name = customerName && customerName !== "Unknown Caller" ? customerName : "The customer";
  const tone = sentiment ?? "neutral";
  if (!compact) return `${name} completed a Retail AI call with ${tone} sentiment.`;

  const transcriptSummary = compact.length > 220 ? `${compact.slice(0, 217).trimEnd()}...` : compact;
  const appointmentPart = appointmentTime
    ? ` An appointment was detected for ${appointmentTime.toLocaleString("en-US")}.`
    : "";
  return `${name} completed a Retail AI call with ${tone} sentiment. ${transcriptSummary}${appointmentPart}`;
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
    const retellDynamicVariables = {
      ...asObject(root.retell_llm_dynamic_variables),
      ...asObject(call.retell_llm_dynamic_variables),
    };
    const direction = firstString(call.direction, root.direction) || "unknown";
    const callType = firstString(call.type, call.call_type, root.type, root.call_type) || "unknown";
    const callStatus = firstString(call.call_status, root.call_status) || "unknown";
    const metadata: Record<string, unknown> = {
      ...asObject(call.metadata),
      ...asObject(root.metadata),
      ...(Object.keys(retellDynamicVariables).length
        ? { retell_llm_dynamic_variables: retellDynamicVariables }
        : {}),
      ...(direction ? { call_direction: direction } : {}),
      ...(callType ? { call_type: callType } : {}),
      ...(callStatus ? { call_status: callStatus } : {}),
    };
    const transcriptJson = normalizeTranscript(call.transcript_object ?? payload.transcript_object ?? payload.transcript);
    const transcript = transcriptText(call.transcript ?? payload.transcript, transcriptJson) || "";
    const sentiment =
      normalizeSentiment(
        analysis.user_sentiment ??
          payload.user_sentiment ??
          customData.user_sentiment ??
          retellDynamicVariables.user_sentiment ??
          root.sentiment,
      ) || inferSentimentFromTranscript(transcript);
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
    
    const extractedName = extractName(detailedSummary, summary, transcript);
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
      name: firstString(
        analysis.customer_name, 
        analysis.userName, 
        analysis.user_name,
        customData.customer_name, 
        customData.customerName, 
        metadata.customer_name, 
        metadata.customerName, 
        retellDynamicVariables.customer_name,
        retellDynamicVariables.customerName,
        extractedName
      ) || "Unknown Caller",
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
       outcome:
        firstString(customData.call_outcome, customData.callOutcome, customData.outcome) ??
        (appointmentBooked ? "appointment_booked" : callSuccessful ? "completed" : "completed_no_booking"),
     };

    // If no summary was provided, generate one
    if (!summary) {
      summary = generateSummaryFromTranscript(transcript, customerData.name, appointment.appointmentTime, sentiment) ||
        generateAISummary({
          customer: customerData,
          appointment,
          insights,
          sentiment,
        });
      console.log(`[RETELL WEBHOOK] Generated fallback summary: ${summary}`);
    }

    console.log("[PARSED_ACTIVITY_DATA]", {
      customer_name: customerData.name,
      appointment_time: appointment.appointmentTime ?? null,
      call_summary: summary,
      sentiment,
      call_outcome: appointment.outcome,
    });

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
