import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import {
  RETELL_API_BASE_URL,
  getConfiguredAgentId,
  getConfiguredAgentVersion,
  getConfiguredRetellPhoneNumber,
  getFirstRetellVoiceAgent,
  getRetellApiKey,
  isE164PhoneNumber,
  normalizeE164PhoneNumber,
} from "@/lib/retell";

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
}) {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = getRetellApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Retell API key is not configured" },
      { status: 400 },
    );
  }

  const fromNumber = normalizeE164PhoneNumber(
    getConfiguredRetellPhoneNumber() ?? "",
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

  if (!requestedPhone || !isE164PhoneNumber(requestedPhone)) {
    return NextResponse.json(
      { error: "Lead phone must include a country code, for example +14155552671" },
      { status: 400 },
    );
  }

  try {
    const opportunity = await prismadb.crm_Opportunities.findFirst({
      where: { id: opportunityId, deletedAt: null },
      include: {
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

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 },
      );
    }

    const linkedContact = memberId
      ? opportunity.contacts
          .map((link) => link.contact)
          .find((contact) => contact.id === memberId)
      : opportunity.contacts[0]?.contact;

    if (memberId && !linkedContact) {
      return NextResponse.json(
        { error: "Member is not linked to this opportunity" },
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
    }

    if (!agentId) {
      return NextResponse.json(
        { error: "No Retell voice agent found" },
        { status: 404 },
      );
    }

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
      to_number: requestedPhone,
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

    const response = await fetch(`${RETELL_API_BASE_URL}/v2/create-phone-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(retellBody),
      cache: "no-store",
    });

    const payload = (await response.json()) as RetellCreatePhoneCallResponse;
    if (!response.ok || !payload.call_id) {
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

    await prismadb.crm_LeadCallTracking.upsert({
      where: { callId: payload.call_id },
      create: {
        callId: payload.call_id,
        opportunityId,
        memberId: memberId || linkedContact?.id,
        phone: requestedPhone,
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
        phone: requestedPhone,
        email: email || undefined,
        agentId: payload.agent_id ?? agentId,
        agentVersion: payload.agent_version ?? agentVersion,
        callStatus: payload.call_status ?? "calling",
        metadata: retellBody.metadata as any,
        createdBy: session.user.id,
      },
    });

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
