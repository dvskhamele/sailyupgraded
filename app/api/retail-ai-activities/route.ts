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
 * Fallback regex extraction from transcript or summary
 */
function extractFromText(text: string, currentData: any) {
  const extracted: any = {};

  // 1. Extract Name (e.g. "My name is Sachin" or "Customer: Sachin")
  if (!currentData.customer_name) {
    const nameMatch = text.match(/(?:my name is|this is|customer:?|speaking with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) extracted.customer_name = nameMatch[1].trim();
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

  // 7. Appointment Time (Textual fallback)
  if (!currentData.appointment_time) {
    const timeMatch = text.match(/(?:appointment|consultation|scheduled for|at|on)\s+([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*[ap]m)?)/i);
    if (timeMatch) extracted.call_outcome = `Scheduled for ${timeMatch[1]}`;
  }

  return extracted;
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const event = body.event || body.type;
  console.log(`Retail AI Webhook received: ${event}`, JSON.stringify(body, null, 2));

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
    if (!isNaN(d.getTime())) appointmentTime = d;
  }

  const mappedData: any = {
    call_id: callId,
    conversationId: callId,
    transcript: body.transcript ?? callData.transcript ?? body.transcript_object ?? callData.transcript_object,
    recordingUrl: body.recordingUrl ?? callData.recording_url,
    call_duration: body.call_duration ?? (callData.duration_ms ? Math.round(callData.duration_ms / 1000) : undefined) ?? callData.duration,
    customer_name: body.customer_name ?? customer.customer_name ?? body.customer?.name,
    phone_number: normalizePhone(body.phone_number ?? customer.customer_phone ?? callData.to_number ?? body.customer?.phone ?? callData.from_number),
    email: normalizeEmail(body.email ?? customer.customer_email ?? body.customer?.email),
    call_summary: body.call_summary ?? analysis.call_summary ?? analysis.summary ?? body.aiGeneratedSummary ?? analysis.description,
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
  const transcriptText = typeof mappedData.transcript === 'string' 
    ? mappedData.transcript 
    : (Array.isArray(mappedData.transcript) 
        ? mappedData.transcript.map((m: any) => m.content).join(" ") 
        : "");
  
  const fallbackData = extractFromText(
    `${mappedData.call_summary} ${transcriptText}`, 
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
