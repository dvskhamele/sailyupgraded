"use server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import {
  getRetellApiKey,
  getConfiguredRetellPhoneNumber,
  ensureRetellAgentWebhookUrl,
  getFirstRetellVoiceAgent,
} from "@/lib/retell-server";
import { RETELL_API_BASE_URL } from "@/lib/retell";
import { normalizeE164PhoneNumber, isE164PhoneNumber } from "@/lib/retell-client";

export interface BulkAICallContactInput {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  state?: string;
  company?: string;
}

export interface BulkAICallParams {
  agentId?: string;
  agentVersion?: number;
  callPurpose?: string;
  contacts: BulkAICallContactInput[];
}

export interface BulkAICallItemResult {
  contactId: string;
  name: string;
  phone: string;
  success: boolean;
  callId?: string;
  error?: string;
}

export interface BulkAICallResponse {
  success: boolean;
  total: number;
  queued: number;
  failed: number;
  results: BulkAICallItemResult[];
  error?: string;
}

export async function bulkAICallContacts(
  params: BulkAICallParams
): Promise<BulkAICallResponse> {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      success: false,
      total: params.contacts?.length || 0,
      queued: 0,
      failed: params.contacts?.length || 0,
      results: [],
      error: "Unauthorized",
    };
  }

  const apiKey = await getRetellApiKey();
  if (!apiKey) {
    return {
      success: false,
      total: params.contacts?.length || 0,
      queued: 0,
      failed: params.contacts?.length || 0,
      results: [],
      error: "AI calling is not configured. Please add AI calling integration credentials in Integrations settings.",
    };
  }

  const rawFromNumber = await getConfiguredRetellPhoneNumber();
  const fromNumber = normalizeE164PhoneNumber(rawFromNumber ?? "");
  if (!fromNumber || !isE164PhoneNumber(fromNumber)) {
    return {
      success: false,
      total: params.contacts?.length || 0,
      queued: 0,
      failed: params.contacts?.length || 0,
      results: [],
      error: "Outbound phone number is not configured or is invalid. Please check Integrations settings.",
    };
  }

  const agentId = params.agentId?.trim();
  const agentVersion = params.agentVersion;

  if (!agentId) {
    return {
      success: false,
      total: params.contacts?.length || 0,
      queued: 0,
      failed: params.contacts?.length || 0,
      results: [],
      error: "No AI calling agent selected. Please select an AI agent.",
    };
  }

  // Ensure agent has the correct webhook URL configured
  try {
    await ensureRetellAgentWebhookUrl(apiKey, agentId);
  } catch (webhookError) {
    console.warn("[BULK_AI_CALL] Webhook URL sync warning:", webhookError);
  }

  const results: BulkAICallItemResult[] = [];
  let queuedCount = 0;
  let failedCount = 0;

  for (const contact of params.contacts) {
    const rawPhone = contact.phone?.trim() || "";
    const normalizedPhone = normalizeE164PhoneNumber(rawPhone);
    const displayName = contact.name?.trim() || "Contact";

    if (!normalizedPhone || !isE164PhoneNumber(normalizedPhone)) {
      results.push({
        contactId: contact.id,
        name: displayName,
        phone: rawPhone,
        success: false,
        error: "Invalid phone number format (requires country code)",
      });
      failedCount++;
      continue;
    }

    try {
      const retellBody: Record<string, unknown> = {
        from_number: fromNumber,
        to_number: normalizedPhone,
        override_agent_id: agentId,
        metadata: {
          source: "crm-bulk-ai-call",
          contact_id: contact.id,
          contact_name: displayName,
          contact_email: contact.email || undefined,
          contact_company: contact.company || undefined,
          call_purpose: params.callPurpose || undefined,
          crm_user_id: session.user.id,
        },
        retell_llm_dynamic_variables: {
          customer_name: displayName,
          customer_email: contact.email || "",
          customer_state: contact.state || "",
          customer_company: contact.company || "",
          call_purpose: params.callPurpose || "",
        },
      };

      if (typeof agentVersion === "number") {
        retellBody.override_agent_version = agentVersion;
      }

      console.log(`[BULK_AI_CALL] Initiating Retell call for ${displayName} (${normalizedPhone})`);

      const response = await fetch(`${RETELL_API_BASE_URL}/v2/create-phone-call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(retellBody),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        call_id?: string;
        agent_id?: string;
        agent_version?: number;
        call_status?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.call_id) {
        const errorMsg = payload.message || payload.error || "Failed to trigger AI call with provider";
        console.error(`[BULK_AI_CALL] Retell error for ${displayName}:`, errorMsg);
        results.push({
          contactId: contact.id,
          name: displayName,
          phone: normalizedPhone,
          success: false,
          error: errorMsg,
        });
        failedCount++;
        continue;
      }

      // Record call tracking entry in CRM
      try {
        await prismadb.crm_LeadCallTracking.upsert({
          where: { callId: payload.call_id },
          create: {
            callId: payload.call_id,
            opportunityId: `contact-${contact.id}`,
            memberId: contact.id,
            phone: normalizedPhone,
            email: contact.email || undefined,
            agentId: payload.agent_id ?? agentId,
            agentVersion: payload.agent_version ?? agentVersion,
            callStatus: payload.call_status ?? "calling",
            appointmentStatus: "none",
            qualificationStatus: "unknown",
            metadata: retellBody.metadata as any,
            createdBy: session.user.id,
          },
          update: {
            memberId: contact.id,
            phone: normalizedPhone,
            email: contact.email || undefined,
            agentId: payload.agent_id ?? agentId,
            agentVersion: payload.agent_version ?? agentVersion,
            callStatus: payload.call_status ?? "calling",
            metadata: retellBody.metadata as any,
            createdBy: session.user.id,
          },
        });
      } catch (dbError) {
        console.warn(`[BULK_AI_CALL] Tracking DB record creation warning:`, dbError);
      }

      results.push({
        contactId: contact.id,
        name: displayName,
        phone: normalizedPhone,
        success: true,
        callId: payload.call_id,
      });
      queuedCount++;

      // Small delay between calls to respect provider pacing and rate limits
      if (params.contacts.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (itemError: any) {
      console.error(`[BULK_AI_CALL] Exception calling ${displayName}:`, itemError);
      results.push({
        contactId: contact.id,
        name: displayName,
        phone: normalizedPhone,
        success: false,
        error: itemError?.message || "Internal server error during call initiation",
      });
      failedCount++;
    }
  }

  return {
    success: queuedCount > 0,
    total: params.contacts.length,
    queued: queuedCount,
    failed: failedCount,
    results,
  };
}
