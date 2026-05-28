import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRetailAIActivity } from "@/actions/crm/retail-ai-activities/create-retail-ai-activity";
import { getRetailAIActivities } from "@/actions/crm/retail-ai-activities/get-retail-ai-activities";
import type {
  RetailAIActivityFilters,
  RetailAIActivityInput,
} from "@/actions/crm/retail-ai-activities/types";

function parseFilters(request: NextRequest): RetailAIActivityFilters {
  const { searchParams } = request.nextUrl;
  const minAIConfidence = searchParams.get("minAIConfidence");
  const maxAIConfidence = searchParams.get("maxAIConfidence");

  return {
    type: (searchParams.get("type") as RetailAIActivityFilters["type"]) ?? "all",
    status: (searchParams.get("status") as RetailAIActivityFilters["status"]) ?? "all",
    contactId: searchParams.get("contactId") ?? undefined,
    assignedTo: searchParams.get("assignedTo") ?? undefined,
    aiStatus: searchParams.get("aiStatus") ?? undefined,
    minAIConfidence: minAIConfidence ? Number(minAIConfidence) : undefined,
    maxAIConfidence: maxAIConfidence ? Number(maxAIConfidence) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const cursorParam = request.nextUrl.searchParams.get("cursor");
  let cursor;
  try {
    cursor = cursorParam ? JSON.parse(cursorParam) : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }
  const result = await getRetailAIActivities(cursor, parseFilters(request));

  return NextResponse.json(result);
}

const COMPLETED_EVENTS = new Set([
  "call_analyzed",
  "call_ended",
  "conversation_completed",
  "conversation_analyzed",
  "post_call_analysis_completed",
]);

/**
 * Normalizes phone numbers to a standard format (removes non-digits)
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Normalizes emails to lowercase
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

/**
 * Attempts to parse a relative date string like "Monday at 7 PM" into a Date object
 */
function parseRelativeDate(text: string): Date | null {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayMatch = text.match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)/i);

  if (!dayMatch || !timeMatch) return null;

  const targetDay = days.indexOf(dayMatch[1].toLowerCase());
  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const ampm = timeMatch[3].toLowerCase();

  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  const now = new Date();
  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);

  // Find the next occurrence of that day
  let daysUntil = (targetDay - now.getDay() + 7) % 7;
  
  // If today is the target day but the time has already passed, go to next week
  if (daysUntil === 0 && result < now) {
    daysUntil = 7;
  }
  
  result.setDate(now.getDate() + daysUntil);
  return result;
}

/**
 * Fallback regex extraction from transcript or summary
 */
function extractFromText(text: string, currentData: any) {
  const extracted: any = {};
  
  // Known AI Agent names and keywords to exclude from customer name
  const EXCLUDE_NAMES = [
    "Rita", "Retell", "AI Assistant", "AI Agent", "Long term", 
    "Whole Life", "Universal Life", "Insurance", "Term Life", 
    "Insurance Agent", "Licensed Expert", "Online Appointment",
    "California", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "Pacific", "Standard Time", "Appointment", "Consultation", "Expert", "Agent", "Assistant",
    "Call Summary", "Transcript", "Recording", "Duration", "Cost", "Outcome"
  ];

  const isValid = (name: string) => {
    if (!name || name.length < 2 || name.length > 50) return false;
    if (!/^[a-zA-Z\s-]+$/.test(name.trim())) return false;
    return !EXCLUDE_NAMES.some(ex => name.toLowerCase() === ex.toLowerCase() || name.toLowerCase().includes(ex.toLowerCase()));
  };

  // 1. Extract Name (e.g. "My name is Sachin" or "Customer: Sachin")
  if (!currentData.customer_name || !isValid(currentData.customer_name)) {
    // Try to find names explicitly mentioned as customer/user
    const explicitMatch = text.match(/(?:customer|user|client)(?::|'s name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    
    if (explicitMatch && isValid(explicitMatch[1].trim())) {
      extracted.customer_name = explicitMatch[1].trim();
    } else {
      // General match but check against agent names and insurance terms
      const nameMatch = text.match(/(?:my name is|this is|speaking with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch) {
        const foundName = nameMatch[1].trim();
        if (isValid(foundName)) {
          extracted.customer_name = foundName;
        }
      }
    }
  }

  // 2. Extract Phone
  if (!currentData.phone_number) {
    const phoneMatch = text.match(/(?:\+?1[-.\s]??)?(?:\d{3}[-.\s]??\d{3}[-.\s]??\d{4}|\(\d{3}\)\s*\d{3}[-.\s]??\d{4}|\d{10})/);
    if (phoneMatch) extracted.phone_number = normalizePhone(phoneMatch[0]);
  }

  // 3. Extract Email
  if (!currentData.email) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) extracted.email = normalizeEmail(emailMatch[0]);
  }

  // 4. Extract State/Location
  if (!currentData.state) {
    const stateMatch = text.match(/(?:in|from|at|state of|live in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (stateMatch) extracted.state = stateMatch[1].trim();
  }

  // 5. Extract Insurance Interest
  if (!currentData.insurance_interest) {
    const interestMatch = text.match(/(?:interested in|looking for|about|type of insurance:?|policy:?)\s+([a-z\s]+(?:life|insurance|plan|coverage))/i);
    if (interestMatch) extracted.insurance_interest = interestMatch[1].trim();
  }

  // 6. Smoker Status
  if (!currentData.smoker_status) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("non-smoker") || lowerText.includes("don't smoke") || lowerText.includes("never smoked")) {
      extracted.smoker_status = "Non-Smoker";
    } else if (lowerText.includes("i smoke") || lowerText.includes("smoker") || lowerText.includes("smoke daily")) {
      extracted.smoker_status = "Smoker";
    }
  }

  // 7. Appointment Time (Textual fallback & parsing)
  if (!currentData.appointment_time) {
    // Look for patterns like "Monday at 7 PM" or "Monday 7 PM"
    const appointmentMatch = text.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*[ap]m/i);
    if (appointmentMatch) {
      const parsedDate = parseRelativeDate(appointmentMatch[0]);
      if (parsedDate) {
        extracted.appointment_time = parsedDate;
      }
      // Also save the textual representation in outcome if not already set
      if (!currentData.call_outcome) {
        extracted.call_outcome = `Scheduled for ${appointmentMatch[0]}`;
      }
    }
  }

  return extracted;
}

export async function POST(request: NextRequest) {
  console.log("[RETAIL AI ACTIVITIES ROUTE] >>>>> WEBHOOK HIT (retail-ai-activities) <<<<<");
  let body: any;
  try {
    const rawBody = await request.text();
    console.log("[RETAIL AI ACTIVITIES ROUTE] Raw Body:", rawBody);
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error("[RETAIL AI ACTIVITIES ROUTE] Invalid JSON payload");
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const event = body.event || body.type;
  console.log(`[RETAIL AI ACTIVITIES ROUTE] Event: ${event}`, JSON.stringify(body, null, 2));

  // 1. Only process completed events
  if (event && !COMPLETED_EVENTS.has(event) && event !== 'call_analyzed') {
    console.log(`Ignoring intermediate event: ${event}`);
    return NextResponse.json({ success: true, message: "Intermediate event ignored" }, { status: 200 });
  }

  const callId = body.call_id || body.conversationId || body.call?.call_id;
  console.log(`Processing Retail AI Activity for callId: ${callId}`);
  
  if (!callId) {
    console.error("No call_id found in webhook payload");
    return NextResponse.json({ success: false, error: "No call_id found" }, { status: 400 });
  }
  
  // Find a fallback user if session is missing (webhooks)
  const fallbackUser = await (prisma as any).users.findFirst({
    where: { role: 'admin' },
    select: { id: true }
  });

  // 2. Check if a record with this callId already exists to avoid duplicates
  const existing = await (prisma as any).crm_RetailAIActivities.findFirst({
    where: {
      OR: [
        { call_id: callId },
        { conversationId: callId }
      ],
      deletedAt: null
    },
    select: { id: true }
  });

  // Extract data from payload (handling nested Retell structure if present)
  const callData = body.call || body;
  const analysis = callData.call_analysis || {};
  const customer = analysis.custom_analysis_data || {};
  const metadata = body.metadata || callData.metadata || {};

  // Safer Date extraction
  const rawAppointmentTime = body.appointment_time || customer.appointment_time || customer.scheduled_time || customer.appointment_date;
  let appointmentTime: Date | undefined = undefined;
  
  if (rawAppointmentTime) {
    const d = new Date(rawAppointmentTime);
    if (!isNaN(d.getTime())) {
      appointmentTime = d;
    } else if (typeof rawAppointmentTime === 'string') {
      // Try parsing relative string like "Monday at 7 PM"
      const parsed = parseRelativeDate(rawAppointmentTime);
      if (parsed) appointmentTime = parsed;
    }
  }

  // Known AI Agent names and keywords to exclude from customer name
  const EXCLUDE_NAMES = [
    "Rita", "Retell", "AI Assistant", "AI Agent", "Long term", 
    "Whole Life", "Universal Life", "Insurance", "Term Life", 
    "Insurance Agent", "Licensed Expert", "Online Appointment",
    "California", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "Pacific", "Standard Time", "Appointment", "Consultation", "Expert", "Agent", "Assistant",
    "Call Summary", "Transcript", "Recording", "Duration", "Cost", "Outcome", "Policy",
    "Financial", "Licensed Expert", "Online", "Appointment", "Expert"
  ];

  /**
   * Helper to validate if a string is a valid human name and not a keyword
   */
  const isValidName = (name: any): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    
    // Strict alphabetic check: letters, spaces, hyphens, apostrophes (2-50 chars)
    if (!/^[A-Za-z\s'-]{2,50}$/.test(trimmed)) return false;
    
    // Reject if name is in exclusion list or contains insurance keywords
    return !EXCLUDE_NAMES.some(ex => {
      const lowerEx = ex.toLowerCase();
      const lowerName = trimmed.toLowerCase();
      return lowerName === lowerEx || lowerName.includes(lowerEx);
    });
  };

  /**
   * Enhanced transcript/summary extraction based on specific agent phrases and patterns
   */
  const extractNameFromText = (text: string): string | null => {
    if (!text) return null;
    
    const patterns = [
      // User's specific pattern from summary: "The user, Dave, called..."
      /the user,?\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?),?\s+(?:called|is|was|expressed)/i,
      /user named\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i,
      /your name is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /you(?:'|’)re all set then,\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /speaking with\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /my name is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && isValidName(match[1])) {
        return match[1].trim();
      }
    }
    return null;
  };

  // 1. Priority-based Name Extraction
  let extractedCustomerName = null;

  // Pre-calculate summary and transcript for extraction
  const callSummary = body.call_summary || analysis.call_summary || analysis.summary || body.aiGeneratedSummary || analysis.description || "";
  const transcriptText = typeof body.transcript === 'string' 
    ? body.transcript 
    : (Array.isArray(body.transcript) 
        ? body.transcript.map((m: any) => m.content).join(" ") 
        : (callData.transcript || ""));

  // Priority 1: AI Summary Pattern (e.g. "The user, Dave, called...") - Usually most accurate for Retail AI
  const summaryName = extractNameFromText(callSummary);
  if (summaryName) {
    extractedCustomerName = summaryName;
  }
  // Priority 2: Structured custom_analysis_data
  else if (isValidName(customer.customer_name)) {
    extractedCustomerName = customer.customer_name;
  } 
  // Priority 3: Structured user_name
  else if (isValidName(analysis.user_name)) {
    extractedCustomerName = analysis.user_name;
  }
  // Priority 4: Transcript phrases
  else {
    const transcriptName = extractNameFromText(transcriptText);
    if (transcriptName) {
      extractedCustomerName = transcriptName;
    }
    // Priority 5: Generic fallbacks
    else if (isValidName(body.customer_name)) {
      extractedCustomerName = body.customer_name;
    } else if (isValidName(customer.name)) {
      extractedCustomerName = customer.name;
    } else if (isValidName(body.customer?.name)) {
      extractedCustomerName = body.customer?.name;
    }
  }

  const mappedData: any = {
    call_id: callId,
    conversationId: callId,
    transcript: body.transcript ?? callData.transcript ?? body.transcript_object ?? callData.transcript_object,
    recordingUrl: body.recordingUrl ?? callData.recording_url,
    call_duration: body.call_duration ?? (callData.duration_ms ? Math.round(callData.duration_ms / 1000) : undefined) ?? callData.duration,
    
    customer_name: extractedCustomerName,
    
    phone_number: normalizePhone(body.phone_number ?? customer.customer_phone ?? callData.to_number ?? body.customer?.phone ?? callData.from_number),
    email: normalizeEmail(body.email ?? customer.customer_email ?? body.customer?.email),
    call_summary: callSummary,
    call_successful: body.call_successful ?? (analysis.call_successful ? 'accepted' : 'reviewed'),
    user_sentiment: body.user_sentiment ?? analysis.user_sentiment ?? body.sentiment ?? analysis.sentiment,
    combined_cost: body.combined_cost ?? metadata.cost ?? callData.combined_cost ?? metadata.total_cost,
    
    // Additional Extraction Fields from payload
    state: body.state ?? customer.state ?? customer.location ?? body.customer?.state ?? customer.region,
    location: body.location ?? customer.location ?? body.customer?.location ?? customer.city,
    timezone: body.timezone ?? customer.timezone ?? body.customer?.timezone,
    insurance_interest: body.insurance_interest ?? customer.insurance_interest ?? customer.insurance_type ?? body.insurance_type ?? customer.plan_interest,
    smoker_status: body.smoker_status ?? customer.smoker_status ?? customer.is_smoker,
    call_outcome: body.call_outcome ?? analysis.call_outcome ?? customer.outcome ?? analysis.outcome,
    consultation_type: body.consultation_type ?? customer.consultation_type ?? customer.appointment_type,
    appointment_time: appointmentTime,

    aiStatus: body.aiStatus || 'reviewed',
    aiSource: body.aiSource || 'Retell AI',
    date: body.date ? new Date(body.date) : new Date(),
    type: "call",
    status: "completed",
    retailAIPayload: body,
  };

  // 4. Fallback Regex Extraction from Transcript & Summary
  const fallbackTranscriptText = typeof mappedData.transcript === 'string' 
    ? mappedData.transcript 
    : (Array.isArray(mappedData.transcript) 
        ? mappedData.transcript.map((m: any) => m.content).join(" ") 
        : (callData.transcript || ""));
  
  const fallbackData = extractFromText(
    `${mappedData.call_summary} ${fallbackTranscriptText}`, 
    mappedData
  );

  // Apply fallback only if field is still missing
  Object.keys(fallbackData).forEach(key => {
    if (!mappedData[key]) {
      mappedData[key] = fallbackData[key];
    }
  });

  if (existing) {
    console.log(`Updating existing Retail AI activity: ${existing.id}`);
    const updated = await (prisma as any).crm_RetailAIActivities.update({
      where: { id: existing.id },
      data: {
        ...mappedData,
        updatedBy: fallbackUser?.id,
        date: undefined, // Don't update original date
        type: undefined,
        links: undefined,
        // Ensure call_id is not changed to null if we already have one
        call_id: mappedData.call_id || undefined,
      }
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // 3. Create new record if it doesn't exist
  // Use a transaction or a try-catch to handle potential race conditions
  try {
    console.log(`Creating new Retail AI activity for call: ${callId}`);
    const activityData: any = {
      ...mappedData,
      links: Array.isArray(body.links) ? body.links : [],
      overrideCreatedBy: fallbackUser?.id
    };

    const result = await createRetailAIActivity(activityData);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    // If someone else created it in the meantime, try updating
    if (err.code === 'P2002') { // Unique constraint violation
      const latestExisting = await (prisma as any).crm_RetailAIActivities.findFirst({
        where: { call_id: callId }
      });
      if (latestExisting) {
        const updated = await (prisma as any).crm_RetailAIActivities.update({
          where: { id: latestExisting.id },
          data: mappedData
        });
        return NextResponse.json({ success: true, data: updated });
      }
    }
    throw err;
  }
}

// Remove the old strict validator as we are now mapping defaults
