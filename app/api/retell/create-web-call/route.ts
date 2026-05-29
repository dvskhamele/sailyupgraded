import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import {
  RETELL_API_BASE_URL,
  ensureRetellAgentWebhookUrl,
  getConfiguredAgentId,
  getConfiguredAgentVersion,
  getFirstRetellVoiceAgent,
  getRetellApiKey,
} from "@/lib/retell";

type CreateWebCallRequest = {
  agentId?: string;
  agentVersion?: number;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = getRetellApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Retell API key is not configured" },
      { status: 400 },
    );
  }

  const requestBody = (await request.json().catch(() => ({}))) as CreateWebCallRequest;

  let agentId = requestBody.agentId ?? getConfiguredAgentId();
  let agentVersion = requestBody.agentVersion ?? getConfiguredAgentVersion();
  let agentName: string | undefined;

  try {
    if (!agentId) {
      const agent = await getFirstRetellVoiceAgent(apiKey);
      agentId = agent?.agent_id;
      agentVersion = agentVersion ?? agent?.version;
      agentName = agent?.agent_name ?? undefined;
    }

    if (!agentId) {
      return NextResponse.json(
        { error: "No Retell voice agent found" },
        { status: 404 },
      );
    }

    await ensureRetellAgentWebhookUrl(apiKey, agentId);

    const user = (session as any).user;
    const body: Record<string, unknown> = {
      agent_id: agentId,
      metadata: {
        source: "nextcrm-crm-dashboard",
        userId: user?.id,
        userEmail: user?.email,
      },
      retell_llm_dynamic_variables: {
        customer_name: user?.name ?? user?.email ?? "CRM user",
      },
    };

    if (typeof agentVersion === "number") {
      body.agent_version = agentVersion;
    }

    const response = await fetch(`${RETELL_API_BASE_URL}/v2/create-web-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.message ??
            payload?.error ??
            "Failed to create Retell web call",
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      accessToken: payload.access_token,
      callId: payload.call_id,
      agentId: payload.agent_id,
      agentVersion: payload.agent_version,
      agentName: payload.agent_name ?? agentName,
    });
  } catch (error) {
    console.error("[RETELL_CREATE_WEB_CALL_POST]", error);
    return NextResponse.json(
      { error: "Failed to create Retell web call" },
      { status: 500 },
    );
  }
}
