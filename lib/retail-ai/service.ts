import { findOrCreateContact } from "@/lib/crm/contact-matching";
import { mapParsedRetailAICallToActivity } from "./mapper";
import { parseRetailAICall, validateRetailAIPayload } from "./parser";
import {
  createRetailAIActivityRecord,
  findRetailAIActivityByConversationId,
} from "./repository";
import type { RetailAIPayload } from "./parser";
import type { RetailAIWebhookResult } from "./types";

const COMPLETED_EVENTS = new Set([
  "call_analyzed",
  "call_ended",
  "conversation_completed",
  "conversation_analyzed",
  "post_call_analysis_completed",
]);

function shouldCreateActivity(event?: string) {
  if (!event) return true;
  return COMPLETED_EVENTS.has(event);
}

function payloadObject(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, any>)
    : {};
}

function getWebhookDiagnostics(payload: unknown) {
  const root = payloadObject(payload);
  const call = payloadObject(root.call);
  const analysis = call.call_analysis ?? root.call_analysis;
  const metadata = call.metadata ?? root.metadata;
  const retellDynamicVariables =
    call.retell_llm_dynamic_variables ?? root.retell_llm_dynamic_variables;
  return {
    call_id: call.call_id ?? call.id ?? root.call_id ?? root.conversation_id ?? root.conversationId,
    transcript: call.transcript ?? root.transcript ?? call.transcript_object ?? root.transcript_object,
    analysis,
    metadata,
    retell_llm_dynamic_variables: retellDynamicVariables,
    direction: call.direction ?? root.direction,
    call_type: call.type ?? call.call_type ?? root.type ?? root.call_type,
    call_status: call.call_status ?? root.call_status,
    event_type: root.event,
    has_call: Boolean(root.call),
    has_transcript: Boolean(call.transcript ?? root.transcript),
    has_transcript_object: Boolean(call.transcript_object ?? root.transcript_object),
    has_call_analysis: Boolean(call.call_analysis ?? root.call_analysis),
    has_customer_metadata: Boolean(
      call.metadata?.customer_name ??
        call.metadata?.customerName ??
        root.metadata?.customer_name ??
        root.metadata?.customerName,
    ),
  };
}

export async function createRetailAIActivityFromWebhook(
  payload: unknown,
  options: { receivedAt?: Date } = {},
): Promise<RetailAIWebhookResult> {
  const diagnostics = getWebhookDiagnostics(payload);

  console.log("[INCOMING_RETAIL_AI_WEBHOOK]", diagnostics);
  console.log("[RETAIL AI SERVICE] Webhook received", {
    call_id: diagnostics.call_id,
    direction: diagnostics.direction,
    call_type: diagnostics.call_type,
    call_status: diagnostics.call_status,
    event_type: diagnostics.event_type,
    has_call: diagnostics.has_call,
    has_transcript: diagnostics.has_transcript,
    has_transcript_object: diagnostics.has_transcript_object,
    has_call_analysis: diagnostics.has_call_analysis,
    has_customer_metadata: diagnostics.has_customer_metadata,
  });
  console.log("[RETAIL AI SERVICE] Payload snapshot:", JSON.stringify(payload, null, 2));

  if (!validateRetailAIPayload(payload)) {
    console.error("[RETAIL AI SERVICE] Validation failed for payload", diagnostics);
    throw new Error("Invalid Retail AI webhook payload");
  }

  const typedPayload = payload as RetailAIPayload;
  console.log(`[RETAIL AI SERVICE] Processing event: ${typedPayload.event}`);

  if (!shouldCreateActivity(typedPayload.event)) {
    console.log(`[RETAIL AI SERVICE] Skipping non-completed event: ${typedPayload.event}`);
    return {
      status: "skipped",
      reason: `Ignoring non-completed event: ${typedPayload.event}`,
    };
  }

  const parsed = parseRetailAICall(typedPayload);
  console.log(`[RETAIL AI SERVICE] Parsed conversationId: ${parsed.conversationId}`);
  
  if (parsed.appointment.booked) {
    console.log(`[RETELL WEBHOOK] Appointment detected: ${parsed.appointment.date} at ${parsed.appointment.time}`);
  }
  console.log(`[RETELL WEBHOOK] Generated call_summary: ${parsed.summary.slice(0, 100)}...`);

  let contactId: string | undefined;
  if (parsed.customer.phone || parsed.customer.email || parsed.customer.name) {
    console.log(`[RETAIL AI SERVICE] Attempting to find/create contact for:`, parsed.customer);
    try {
      const contact = await findOrCreateContact({
        phone: parsed.customer.phone,
        email: parsed.customer.email,
        name: parsed.customer.name,
        source: "Retail AI Call",
      });
      contactId = contact.id;
      console.log(`[RETAIL AI SERVICE] Contact found/created: ${contactId}`);
    } catch (contactError) {
      console.error(`[RETAIL AI SERVICE] Contact matching failed:`, contactError);
      // We continue even if contact matching fails, so we don't lose the activity
    }
  }

  const activityInput = mapParsedRetailAICallToActivity(parsed, {
    contactId,
    receivedAt: options.receivedAt,
  });
  
  console.log("[RETAIL AI SERVICE] Mapping complete. Input for repository:", JSON.stringify({
    ...activityInput,
    retailAIPayload: "[TRUNCATED]",
    transcript: "[TRUNCATED]"
  }, null, 2));

  console.log("[RETAIL AI SERVICE] UPSERTING Retail AI activity", {
    call_id: parsed.conversationId,
    direction: parsed.metadata.call_direction,
    call_type: parsed.metadata.call_type,
    event: typedPayload.event,
  });
  
  let activity;
  try {
    activity = await createRetailAIActivityRecord(activityInput);
    console.log("[RETAIL AI SERVICE] Activity record persisted successfully", {
      call_id: parsed.conversationId,
      activity_id: activity.id,
    });
  } catch (error: any) {
    console.error("[RETAIL AI SERVICE] Persistence failed CRITICAL", {
      call_id: parsed.conversationId,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }

  return {
    status: "created",
    activityId: activity.id,
    contactId,
    parsed,
  };
}
