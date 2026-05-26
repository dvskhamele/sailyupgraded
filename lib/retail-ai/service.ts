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
  if (!validateRetailAIPayload(payload)) {
    throw new Error("Invalid Retail AI webhook payload");
  }

  const typedPayload = payload as RetailAIPayload;
  if (!shouldCreateActivity(typedPayload.event)) {
    return {
      status: "skipped",
      reason: `Ignoring non-completed event: ${typedPayload.event}`,
    };
  }

  const parsed = parseRetailAICall(typedPayload);
  const existing = await findRetailAIActivityByConversationId(parsed.conversationId);
  if (existing) {
    return {
      status: "skipped",
      reason: "duplicate conversationId",
      activityId: existing.id,
      parsed,
    };
  }

  let contactId: string | undefined;
  if (parsed.customer.phone || parsed.customer.email || parsed.customer.name) {
    const contact = await findOrCreateContact({
      phone: parsed.customer.phone,
      email: parsed.customer.email,
      name: parsed.customer.name,
      source: "Retail AI Call",
    });
    contactId = contact.id;
  }

  const activityInput = mapParsedRetailAICallToActivity(parsed, {
    contactId,
    receivedAt: options.receivedAt,
  });
  const activity = await createRetailAIActivityRecord(activityInput);

  return {
    status: "created",
    activityId: activity.id,
    contactId,
    parsed,
  };
}
