import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import {
  ensureRetellAgentWebhookUrl,
  getRetellApiKey,
  getConfiguredRetellPhoneNumber,
} from "@/lib/retell-server";
import { normalizeE164PhoneNumber } from "@/lib/retell-client";

const RETELL_API_BASE_URL = "https://api.retellai.com";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getRetellApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Retell API key is not configured" }, { status: 400 });
  }

  const fromNumber = normalizeE164PhoneNumber((await getConfiguredRetellPhoneNumber()) ?? "");
  if (!fromNumber) {
    return NextResponse.json({ error: "Retell outbound phone number is not configured" }, { status: 400 });
  }

  try {
    const { agent_id, to_number, lead_id } = await request.json();

    if (!agent_id || !to_number || !lead_id) {
      return NextResponse.json({ error: "Missing required fields: agent_id, to_number, or lead_id" }, { status: 400 });
    }

    await ensureRetellAgentWebhookUrl(apiKey, agent_id);

    const retellBody = {
      from_number: fromNumber,
      to_number: normalizeE164PhoneNumber(to_number),
      agent_id: agent_id,
      metadata: {
        source: "crm-outbound-trigger",
        opportunity_id: lead_id,
        crm_user_id: session.user.id,
      },
    };

    console.log("[RETELL_OUTBOUND_CALL_REQUEST]", JSON.stringify(retellBody, null, 2));

    const response = await fetch(`${RETELL_API_BASE_URL}/v2/create-phone-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(retellBody),
    });

    const payload = await response.json();
    console.log("[RETELL_OUTBOUND_CALL_RESPONSE]", JSON.stringify(payload, null, 2));

    if (!response.ok || !payload.call_id) {
      return NextResponse.json(
        { error: payload?.message || payload?.error || "Failed to trigger Retell outbound call" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      call_id: payload.call_id,
      status: payload.call_status || "calling",
    });
  } catch (error: any) {
    console.error("[RETELL_OUTBOUND_CALL_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
