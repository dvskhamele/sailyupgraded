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

export async function createRetailAIActivityFromWebhook(
  payload: unknown,
  options: { receivedAt?: Date } = {},
): Promise<RetailAIWebhookResult> {
  console.log("[RETAIL AI SERVICE] Received payload:", JSON.stringify(payload, null, 2));

  if (!validateRetailAIPayload(payload)) {
    console.error("[RETAIL AI SERVICE] Validation failed for payload");
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

  const existing = await findRetailAIActivityByConversationId(parsed.conversationId);
  if (existing) {
    console.log(`[RETAIL AI SERVICE] Skipping duplicate conversationId: ${parsed.conversationId}`);
    return {
      status: "skipped",
      reason: "duplicate conversationId",
      activityId: existing.id,
      parsed,
    };
  }

  let contactId: string | undefined;
  if (parsed.customer.phone || parsed.customer.email || parsed.customer.name) {
    console.log(`[RETAIL AI SERVICE] Attempting to find/create contact for:`, parsed.customer);
    const contact = await findOrCreateContact({
      phone: parsed.customer.phone,
      email: parsed.customer.email,
      name: parsed.customer.name,
      source: "Retail AI Call",
    });
    contactId = contact.id;
    console.log(`[RETAIL AI SERVICE] Contact found/created: ${contactId}`);
  }

  const activityInput = mapParsedRetailAICallToActivity(parsed, {
    contactId,
    receivedAt: options.receivedAt,
  });
  
  console.log(`[RETAIL AI SERVICE] Creating activity record for callId: ${parsed.conversationId}`);
  const activity = await createRetailAIActivityRecord(activityInput);
  console.log(`[RETAIL AI SERVICE] Activity record created: ${activity.id}`);

  return {
    status: "created",
    activityId: activity.id,
    contactId,
    parsed,
  };
}
