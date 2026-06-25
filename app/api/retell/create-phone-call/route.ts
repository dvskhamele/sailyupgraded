import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import {
  getConfiguredAgentId,
  getConfiguredAgentVersion,
  getConfiguredRetellPhoneNumber,
  getFirstRetellVoiceAgent,
  getRetellApiKey,
  getRetellApiKeySource,
  getRetellRuntimeDiagnostics,
  ensureRetellAgentWebhookUrl,
  fingerprintSecret,
} from "@/lib/retell-server";
import { isE164PhoneNumber, normalizeE164PhoneNumber } from "@/lib/retell-client";

const RETELL_API_BASE_URL = "https://api.retellai.com";

type CreatePhoneCallRequest = {
  opportunityId?: string;
  memberId?: string;
  memberName?: string;
  phone?: string;
  email?: string;
  state?: string;
  agentId?: string;
  agentVersion?: number;
};

type RetellCreatePhoneCallResponse = {
  call_id?: string;
  agent_id?: string;
  agent_version?: number;
  call_status?: string;
  message?: string;
  error?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getContactName(contact?: {
  first_name?: string | null;
  last_name?: string | null;
} | null) {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();
}

function getContactPhone(contact?: {
  phone?: string | null;
  mobile_phone?: string | null;
  office_phone?: string | null;
} | null) {
  const phone =
    contact?.phone?.trim() ||
    contact?.mobile_phone?.trim() ||
    contact?.office_phone?.trim() ||
    "";
  const selectedPhoneField = contact?.phone?.trim()
    ? "phone"
    : contact?.mobile_phone?.trim()
      ? "mobile_phone"
      : contact?.office_phone?.trim()
        ? "office_phone"
        : null;

  return { phone, selectedPhoneField };
}

async function readRetellCreatePhoneCallPayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return undefined;

  try {
    return JSON.parse(text) as RetellCreatePhoneCallResponse;
  } catch {
    return { error: text } satisfies RetellCreatePhoneCallResponse;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getRetellApiKey();
  console.log(
    "[RETELL_CREATE_PHONE_CALL] Env diagnostics",
    await getRetellRuntimeDiagnostics(),
  );

  if (!apiKey) {
    return NextResponse.json(
      { error: "Retell API key is not configured" },
      { status: 400 },
    );
  }

  const fromNumber = normalizeE164PhoneNumber(
    (await getConfiguredRetellPhoneNumber()) ?? "",
  );
  if (!fromNumber) {
    return NextResponse.json(
      { error: "Retell outbound phone number is not configured" },
      { status: 400 },
    );
  }

  if (!isE164PhoneNumber(fromNumber)) {
    return NextResponse.json(
      { error: "RETELL_PHONE_NUMBER must include a country code, for example +14155552671" },
      { status: 400 },
    );
  }

  const requestBody = (await request.json().catch(() => ({}))) as CreatePhoneCallRequest;
  const opportunityId = cleanString(requestBody.opportunityId);
  const memberId = cleanString(requestBody.memberId);
  const requestedPhone = normalizeE164PhoneNumber(
    cleanString(requestBody.phone),
  );

  if (!opportunityId) {
    return NextResponse.json(
      { error: "opportunityId is required" },
      { status: 400 },
    );
  }

  try {
    console.log(`[RETELL_CREATE_PHONE_CALL] Fetching opportunity: ${opportunityId}`);
    const dbStartTime = Date.now();
    const opportunity = await prismadb.crm_Opportunities.findFirst({
      where: { id: opportunityId, deletedAt: null },
      select: {
        id: true,
        name: true,
        clientName: true,
        contact: true,
        contacts: {
          include: {
            contact: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                personal_email: true,
                phone: true,
                mobile_phone: true,
                office_phone: true,
                state: true,
              },
            },
          },
        },
      },
    });
    const dbEndTime = Date.now();
    console.log(`[RETELL_CREATE_PHONE_CALL] Opportunity fetched in ${dbEndTime - dbStartTime}ms`);

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    const assignedContact = opportunity.contact
      ? await prismadb.crm_Contacts.findFirst({
          where: {
            id: opportunity.contact,
            deletedAt: null,
          },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            personal_email: true,
            phone: true,
            mobile_phone: true,
            office_phone: true,
            state: true,
          },
        })
      : null;

    const junctionContacts = opportunity.contacts
      .map((link) => link.contact)
      .filter(Boolean);

    const linkedContact = memberId
      ? (assignedContact?.id === memberId
          ? assignedContact
          : junctionContacts.find((contact) => contact.id === memberId) ?? null)
      : assignedContact ?? junctionContacts[0] ?? null;
    const linkedContactPhone = getContactPhone(linkedContact);
    const finalResolvedPhone = normalizeE164PhoneNumber(
      requestedPhone || linkedContactPhone.phone,
    );

    console.log("[RETELL_CREATE_PHONE_CALL_CONTACT_RESOLUTION]", {
      opportunityId: opportunity.id,
      opportunityContact: opportunity.contact ?? null,
      assignedClientId: assignedContact?.id ?? null,
      resolvedContactId: linkedContact?.id ?? null,
      resolvedContactPhone: linkedContact?.phone ?? null,
      resolvedContactMobilePhone: linkedContact?.mobile_phone ?? null,
      resolvedContactOfficePhone: linkedContact?.office_phone ?? null,
      finalResolvedPhone: finalResolvedPhone || null,
      selectedPhoneField: requestedPhone
        ? "requestBody.phone"
        : linkedContactPhone.selectedPhoneField,
    });

    if (memberId && !linkedContact) {
      return NextResponse.json(
        { error: "Member is not linked to this opportunity" },
        { status: 400 },
      );
    }

    if (!finalResolvedPhone || !isE164PhoneNumber(finalResolvedPhone)) {
      return NextResponse.json(
        { error: "Client phone must include a country code, for example +14155552671" },
        { status: 400 },
      );
    }

    let agentId = cleanString(requestBody.agentId) || getConfiguredAgentId();
    let agentVersion =
      typeof requestBody.agentVersion === "number"
        ? requestBody.agentVersion
        : getConfiguredAgentVersion();

    if (!agentId) {
      const agent = await getFirstRetellVoiceAgent(apiKey);
      agentId = agent?.agent_id;
      agentVersion = agentVersion ?? agent?.version;
      console.log("[RETELL_CREATE_PHONE_CALL] Selected first Retell voice agent", {
        agentId,
        agentVersion,
        agentName: agent?.agent_name ?? null,
        isPublished: agent?.is_published ?? null,
        webhookUrl: agent?.webhook_url ?? null,
        responseEngineType: agent?.response_engine?.type ?? null,
      });
    }

    if (!agentId) {
      return NextResponse.json(
        { error: "No Retell voice agent found" },
        { status: 404 },
      );
    }

    console.log("[RETELL_CREATE_PHONE_CALL] Using Retell agent", {
      requestAgentId: cleanString(requestBody.agentId) || null,
      configuredAgentId: getConfiguredAgentId() || null,
      finalAgentId: agentId,
      finalAgentVersion: agentVersion ?? null,
      apiKeySource: getRetellApiKeySource(),
      apiKeyFingerprint: fingerprintSecret(apiKey),
    });

    await ensureRetellAgentWebhookUrl(apiKey, agentId);

    const memberName =
      cleanString(requestBody.memberName) ||
      getContactName(linkedContact) ||
      cleanString((opportunity as any).clientName) ||
      cleanString(opportunity.name) ||
      "Customer";
    const email =
      cleanString(requestBody.email) ||
      cleanString(linkedContact?.email) ||
      cleanString(linkedContact?.personal_email);
    const state =
      cleanString(requestBody.state) || cleanString(linkedContact?.state);

    const retellBody: Record<string, unknown> = {
      from_number: fromNumber,
      to_number: finalResolvedPhone,
      override_agent_id: agentId,
      metadata: {
        source: "crm-opportunity-card",
        opportunity_id: opportunityId,
        member_id: memberId || linkedContact?.id,
        member_email: email || undefined,
        crm_user_id: session.user.id,
      },
      retell_llm_dynamic_variables: {
        customer_name: memberName,
        customer_state: state || "",
        customer_email: email || "",
      },
    };

    if (typeof agentVersion === "number") {
      retellBody.override_agent_version = agentVersion;
    }

    console.log(`[RETELL_CREATE_PHONE_CALL] Initiating fetch to Retell API: ${RETELL_API_BASE_URL}/v2/create-phone-call`);
    console.log("[RETELL_CREATE_PHONE_CALL] Request Details", {
      from_number: fromNumber,
      to_number: finalResolvedPhone,
      overrideAgentId: agentId,
      overrideAgentVersion: agentVersion ?? null,
      metadata: retellBody.metadata,
      apiKeySource: getRetellApiKeySource(),
      apiKeyFingerprint: fingerprintSecret(apiKey),
    });
    const startTime = Date.now();
    
    const response = await fetch(`${RETELL_API_BASE_URL}/v2/create-phone-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(retellBody),
      cache: "no-store",
    });

    const endTime = Date.now();
    console.log(`[RETELL_CREATE_PHONE_CALL] Retell API responded in ${endTime - startTime}ms with status: ${response.status}`);

    const payload = (await readRetellCreatePhoneCallPayload(response)) ?? {};
    console.log(`[RETELL_CREATE_PHONE_CALL] Retell API Payload:`, JSON.stringify(payload, null, 2));

    if (!response.ok || !payload.call_id) {
      console.error(`[RETELL_CREATE_PHONE_CALL] Retell API Error:`, {
        status: response.status,
        statusText: response.statusText,
        payload,
        apiKeySource: getRetellApiKeySource(),
        apiKeyFingerprint: fingerprintSecret(apiKey),
        agentId,
        agentVersion: agentVersion ?? null,
      });
      return NextResponse.json(
        {
          error:
            payload?.message ??
            payload?.error ??
            "Failed to create Retell phone call",
        },
        { status: response.status },
      );
    }

    console.log(`[RETELL_CREATE_PHONE_CALL] Upserting LeadCallTracking for call_id: ${payload.call_id}`);
    const trackingStartTime = Date.now();
    await prismadb.crm_LeadCallTracking.upsert({
      where: { callId: payload.call_id },
      create: {
        callId: payload.call_id,
        opportunityId,
        memberId: memberId || linkedContact?.id,
        phone: finalResolvedPhone,
        email: email || undefined,
        agentId: payload.agent_id ?? agentId,
        agentVersion: payload.agent_version ?? agentVersion,
        callStatus: payload.call_status ?? "calling",
        appointmentStatus: "none",
        qualificationStatus: "unknown",
        metadata: retellBody.metadata as any,
        createdBy: session.user.id,
      },
      update: {
        opportunityId,
        memberId: memberId || linkedContact?.id,
        phone: finalResolvedPhone,
        email: email || undefined,
        agentId: payload.agent_id ?? agentId,
        agentVersion: payload.agent_version ?? agentVersion,
        callStatus: payload.call_status ?? "calling",
        metadata: retellBody.metadata as any,
        createdBy: session.user.id,
      },
    });
    const trackingEndTime = Date.now();
    console.log(`[RETELL_CREATE_PHONE_CALL] LeadCallTracking upserted in ${trackingEndTime - trackingStartTime}ms`);

    return NextResponse.json({
      success: true,
      callId: payload.call_id,
      agentId: payload.agent_id ?? agentId,
      status: payload.call_status ?? "calling",
    });
  } catch (error) {
    console.error("[RETELL_CREATE_PHONE_CALL_POST]", error);
    return NextResponse.json(
      { error: "Failed to create Retell phone call" },
      { status: 500 },
    );
  }
}
