import { NextResponse } from "next/server";

import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { sendSMS } from "@/actions/crm/sms/send-sms";
import { createRetailAIActivityFromWebhook } from "@/lib/retail-ai/service";

type RetellWebhookPayload = {
  event?: string;
  call?: RetellWebhookCall;
};

type RetellWebhookCall = {
  call_id?: string;
  agent_id?: string;
  agent_version?: number;
  type?: string;
  call_type?: string;
  direction?: string;
  call_status?: string;
  from_number?: string;
  to_number?: string;
  metadata?: Record<string, unknown>;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  transcript?: string;
  transcript_object?: unknown;
  recording_url?: string;
  call_analysis?: {
    call_summary?: string;
    summary?: string;
    custom_analysis_data?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

const handledEvents = new Set([
  "call_started",
  "call_ended",
  "call_analyzed",
  "post_call_analysis_completed",
  "conversation_completed",
  "conversation_analyzed",
  "voicemail_reached",
  "dial_no_answer",
  "user_hangup",
  "agent_hangup",
]);

const COMPLETED_EVENTS = new Set([
  "call_ended",
  "call_analyzed",
  "post_call_analysis_completed",
  "conversation_completed",
  "conversation_analyzed",
]);

function dateFromRetellTimestamp(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getCallType(call: RetellWebhookCall) {
  return stringValue(call.type) ?? stringValue(call.call_type);
}

function statusForEvent(event: string, call: RetellWebhookCall) {
  const reason = stringValue(call.disconnection_reason);

  if (event === "call_started") {
    return "active";
  }

  if (event === "call_analyzed") {
    return "ended";
  }

  if (event === "voicemail_reached" || reason === "voicemail_reached") {
    return "voicemail";
  }

  if (event === "dial_no_answer" || reason === "dial_no_answer") {
    return "failed";
  }

  if (event === "user_hangup" || event === "agent_hangup") {
    return "ended";
  }

  return call.call_status ?? "ended";
}

function durationSeconds(call: RetellWebhookCall) {
  if (typeof call.duration_ms === "number") {
    return Math.round(call.duration_ms / 1000);
  }

  if (
    typeof call.start_timestamp === "number" &&
    typeof call.end_timestamp === "number"
  ) {
    return Math.max(
      0,
      Math.round((call.end_timestamp - call.start_timestamp) / 1000),
    );
  }

  return undefined;
}

function getSummary(call: RetellWebhookCall) {
  return (
    stringValue(call.call_analysis?.call_summary) ??
    stringValue(call.call_analysis?.summary)
  );
}

function getCustomAnalysisValue(
  customData: Record<string, unknown> | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = stringValue(customData?.[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

async function saveWebhookEventLog(
  callId: string,
  event: string,
  payload: unknown,
) {
  try {
    await withPrismaRetry(() =>
      prismadb.crm_LeadCallWebhookEvent.create({
        data: {
          callId,
          event,
          payload: payload as any,
        },
      }),
    );
  } catch (error) {
    console.error("[RETELL WEBHOOK] Failed to save event log:", error);
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log("[RETELL WEBHOOK] >>>>> WEBHOOK HIT START <<<<<");
  
  const rawBody = await request.text();
  let payload: any;

  try {
    payload = JSON.parse(rawBody);
    console.log("[RETELL WEBHOOK] Parsed JSON payload successfully");
  } catch (parseError) {
    console.error("[RETELL WEBHOOK] CRITICAL: Invalid JSON payload received:", rawBody);
    console.error("[RETELL WEBHOOK] Parse Error:", parseError);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const headers = Object.fromEntries(request.headers.entries());
  console.log("[RETELL WEBHOOK] Headers:", JSON.stringify(headers, null, 2));

  const event = stringValue(payload.event);
  const call = payload.call || {};
  
  // Flexible Call ID Extraction
  const callId = stringValue(call.call_id) || 
                 stringValue(call.id) || 
                 stringValue(payload.call_id) || 
                 stringValue(payload.conversation_id) || 
                 stringValue(payload.conversationId);

  console.log(`[RETELL WEBHOOK] EVENT: ${event} | CALL ID: ${callId}`);
  console.log(`[RETELL WEBHOOK] FULL PAYLOAD:`, JSON.stringify(payload, null, 2));

  if (!event || !callId) {
    console.error("[RETELL WEBHOOK] FAILED: Missing required fields (event or callId)", { event, callId });
    
    // Attempt to save raw event for debugging anyway
    try {
      await saveWebhookEventLog(callId || "unknown", event || "unknown", payload);
      console.log("[RETELL WEBHOOK] Saved raw event for debugging despite missing fields");
    } catch (e) {
      console.error("[RETELL WEBHOOK] Could not even save raw event log:", e);
    }
    
    return NextResponse.json(
      { error: "Retell webhook event and callId are required" },
      { status: 400 },
    );
  }

  const metadata = call.metadata ?? {};
  const callType = getCallType(call);
  const direction = stringValue(call.direction);
  const callStatus = stringValue(call.call_status);

  console.log("[RETELL WEBHOOK] Call Context", {
    call_id: callId,
    direction,
    call_type: callType,
    call_status: callStatus,
    event_type: event,
    from_number: call.from_number,
    to_number: call.to_number,
  });

  // Support All Retell Events (Step 3)
  if (!handledEvents.has(event)) {
    console.warn(`[RETELL WEBHOOK] UNSUPPORTED EVENT: ${event}. Saving as raw event log.`);
    try {
      await saveWebhookEventLog(callId, event, payload);
    } catch (e) {
      console.error("[RETELL WEBHOOK] Failed to save unsupported event log:", e);
    }
    return new NextResponse(null, { status: 204 });
  }

  const customAnalysisData = call.call_analysis?.custom_analysis_data;
  const opportunityId = stringValue(metadata.opportunity_id);
  const memberId = stringValue(metadata.member_id);
  const email = stringValue(metadata.member_email);
  const startedAt = dateFromRetellTimestamp(call.start_timestamp);
  const endedAt = dateFromRetellTimestamp(call.end_timestamp);
  
  // Safe Transcript Parsing
  const transcript =
    stringValue(call.transcript) ??
    (call.transcript_object ? JSON.stringify(call.transcript_object) : undefined);
    
  const appointmentStatus =
    getCustomAnalysisValue(customAnalysisData, [
      "appointment_status",
      "appointmentStatus",
      "appointment",
    ]) ?? "none";
    
  const qualificationStatus =
    getCustomAnalysisValue(customAnalysisData, [
      "qualification_status",
      "qualificationStatus",
      "qualified",
      "lead_status",
    ]) ?? "unknown";

  console.log(`[RETELL WEBHOOK] PROCESSING PIPELINE START for callId: ${callId}`);
  const pipelineStart = Date.now();

  try {
    // 1. Call Tracking Update
    console.log(`[RETELL WEBHOOK] Step 1: Upserting Call Tracking for: ${callId}`);
    const step1Start = Date.now();
    await withPrismaRetry(() =>
      prismadb.crm_LeadCallTracking.upsert({
        where: { callId },
        create: {
          callId,
          opportunityId: opportunityId ?? "unknown",
          memberId,
          phone: call.to_number ?? "",
          email,
          agentId: call.agent_id,
          agentVersion: call.agent_version,
          callStatus: statusForEvent(event, call),
          callDisposition: call.disconnection_reason,
          transcript,
          summary: getSummary(call),
          appointmentStatus,
          qualificationStatus,
          duration: durationSeconds(call),
          recordingUrl: call.recording_url,
          startedAt,
          endedAt,
          metadata: metadata as any,
          analysis: call.call_analysis as any,
          lastWebhookEvent: event,
        },
        update: {
          memberId,
          phone: call.to_number,
          email,
          agentId: call.agent_id,
          agentVersion: call.agent_version,
          callStatus: statusForEvent(event, call),
          callDisposition: call.disconnection_reason,
          transcript: transcript || undefined,
          summary: getSummary(call) || undefined,
          appointmentStatus,
          qualificationStatus,
          duration: durationSeconds(call),
          recordingUrl: call.recording_url,
          startedAt,
          endedAt,
          metadata: metadata as any,
          analysis: call.call_analysis as any,
          lastWebhookEvent: event,
        },
      }),
    );
    await saveWebhookEventLog(callId, event, payload);
    console.log(`[RETELL WEBHOOK] Step 1 SUCCESS in ${Date.now() - step1Start}ms: Call Tracking updated for: ${callId}`);

    // 2. Retail AI Activity Creation (Step 1-13)
    if (COMPLETED_EVENTS.has(event)) {
      console.log(`[RETELL WEBHOOK] Step 2: Triggering Retail AI Activity creation for event: ${event}`);
      const step2Start = Date.now();
      try {
        const result = await createRetailAIActivityFromWebhook(payload, { receivedAt: new Date() });
        console.log(`[RETELL WEBHOOK] Step 2 SUCCESS in ${Date.now() - step2Start}ms: Retail AI Activity Result:`, JSON.stringify(result, null, 2));
      } catch (activityError: any) {
        console.error(`[RETELL WEBHOOK] Step 2 FAILED after ${Date.now() - step2Start}ms: Pipeline error for callId: ${callId}`);
        console.error(`[RETELL WEBHOOK] Error Message: ${activityError.message}`);
        console.error(`[RETELL WEBHOOK] Error Stack:`, activityError.stack);
        // We don't return 500 here to avoid Retell retrying forever if it's a transient DB error
      }
      
      // 3. Automated SMS triggers
      const phone = call.to_number;
      if (phone) {
        try {
          if (appointmentStatus === "scheduled" || appointmentStatus === "booked") {
            console.log(`[RETELL WEBHOOK] Triggering SMS: Appointment booked for ${phone}`);
            await sendSMS({
              to: phone,
              message: `Hi! Your appointment with BlueTide Financial has been booked. We look forward to speaking with you!`,
              opportunityId,
            });
          } else if (qualificationStatus === "qualified") {
             console.log(`[RETELL WEBHOOK] Triggering SMS: Lead qualified for ${phone}`);
             await sendSMS({
              to: phone,
              message: `Thank you for speaking with us! We've marked you as a qualified lead and will be in touch soon.`,
              opportunityId,
            });
          }
        } catch (smsError) {
          console.error("[RETELL WEBHOOK] SMS Trigger failed:", smsError);
        }
      }
    } else if (event === "dial_no_answer" || event === "voicemail_reached") {
       const phone = call.to_number;
       if (phone) {
         try {
           console.log(`[RETELL WEBHOOK] Triggering SMS: Missed call for ${phone}`);
           await sendSMS({
             to: phone,
             message: `Hi! We tried to reach you from BlueTide Financial but missed you. We'll try again later, or feel free to call us back!`,
             opportunityId,
           });
         } catch (smsError) {
           console.error("[RETELL WEBHOOK] SMS Trigger failed:", smsError);
         }
       }
    }

    console.log(`[RETELL WEBHOOK] PIPELINE COMPLETE for callId: ${callId} in ${Date.now() - pipelineStart}ms`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[RETELL WEBHOOK] CRITICAL PIPELINE FAILURE:", error);
    return NextResponse.json(
      { error: "Internal server error during webhook processing" },
      { status: 500 },
    );
  }
}
