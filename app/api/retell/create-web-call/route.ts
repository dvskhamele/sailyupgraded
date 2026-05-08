import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";

const RETELL_API_BASE_URL = "https://api.retellai.com";

type RetellAgent = {
  agent_id?: string;
  version?: number;
  agent_name?: string | null;
  is_published?: boolean;
};

function getRetellApiKey() {
  return process.env.RETELL_API_KEY ?? process.env.RETAIL_API_KEY;
}

function getConfiguredAgentId() {
  return process.env.RETELL_AGENT_ID ?? process.env.RETAIL_AGENT_ID;
}

function getConfiguredAgentVersion() {
  const value = process.env.RETELL_AGENT_VERSION ?? process.env.RETAIL_AGENT_VERSION;
  if (!value) {
    return undefined;
  }

  const version = Number(value);
  return Number.isInteger(version) ? version : undefined;
}

async function getFirstVoiceAgent(apiKey: string) {
  const response = await fetch(
    `${RETELL_API_BASE_URL}/list-agents?is_latest=true&limit=100`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load Retell voice agents");
  }

  const agents = (await response.json()) as RetellAgent[];
  return (
    agents.find((agent) => agent.is_published && agent.agent_id) ??
    agents.find((agent) => agent.agent_id)
  );
}

export async function POST() {
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

  let agentId = getConfiguredAgentId();
  let agentVersion = getConfiguredAgentVersion();
  let agentName: string | undefined;

  try {
    if (!agentId) {
      const agent = await getFirstVoiceAgent(apiKey);
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
