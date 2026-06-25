import "server-only";
import { getRetellIntegration } from "@/lib/integrations/retell";
import {
  RETELL_API_BASE_URL,
  RETELL_FETCH_TIMEOUT_MS,
  RETELL_PRODUCTION_WEBHOOK_URL,
  RetellResponseEngine,
  fingerprintSecret,
} from "@/lib/retell";

const syncedWebhookAgentIds = new Set<string>();

export { fingerprintSecret };

// NO process.env fallbacks - only use Integration table
export async function getRetellApiKey(teamId?: string) {
  const integration = await getRetellIntegration(teamId);
  if (!integration) return null;
  return integration.apiKey;
}

export function getRetellApiKeySource() {
  return "database";
}

export function getConfiguredAgentId() {
  // If needed later, this can come from Integration settings
  return null;
}

export function getConfiguredAgentVersion() {
  return undefined;
}

export async function getConfiguredRetellPhoneNumber(teamId?: string) {
  const integration = await getRetellIntegration(teamId);
  if (!integration) return null;
  return integration.phoneNumber;
}

export async function getRetellWebhookConfig(teamId?: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const integration = await getRetellIntegration(teamId);
  const webhookUrl = integration?.webhookUrl
    ? integration.webhookUrl
    : RETELL_PRODUCTION_WEBHOOK_URL;

  return {
    webhookUrl,
    environment: isProduction ? "production" : "development",
  };
}

async function readRetellErrorPayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function getRetellRuntimeDiagnostics(teamId?: string) {
  const apiKey = await getRetellApiKey(teamId);
  const { webhookUrl, environment } = await getRetellWebhookConfig(teamId);
  const phoneNumber = await getConfiguredRetellPhoneNumber(teamId);

  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    environment,
    productionModeActive: process.env.NODE_ENV === "production",
    webhookUrl: webhookUrl || null,
    apiKeySource: "database",
    apiKeyFingerprint: apiKey ? `prefix=${apiKey.slice(0, 6)} len=${apiKey.length}` : "missing",
    configuredAgentId: null,
    configuredAgentVersion: undefined,
    retellWorkspaceIdentifier: null,
    hasRetellWebhookUrl: !!webhookUrl,
    phoneNumberFingerprint: phoneNumber ? `prefix=${phoneNumber.slice(0, 3)} len=${phoneNumber.length}` : "missing",
  };
}

export async function logRetellWebhookUrl(teamId?: string) {
  const { webhookUrl, environment } = await getRetellWebhookConfig(teamId);
  console.log(
    `[RETELL WEBHOOK URL] ${webhookUrl || "not configured"} (${environment})`,
  );
}

export async function listRetellAgents(apiKey: string) {
  const response = await fetch(
    `${RETELL_API_BASE_URL}/list-agents?is_latest=true&limit=100`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(RETELL_FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const payload = await readRetellErrorPayload(response);
    console.error("[RETELL_LIST_AGENTS_ERROR]", {
      status: response.status,
      statusText: response.statusText,
      payload,
    });
    throw new Error("Unable to load Retell voice agents");
  }

  return (await response.json()) as Array<{
    agent_id?: string;
    version?: number;
    agent_name?: string | null;
    is_published?: boolean;
    webhook_url?: string | null;
    response_engine?: RetellResponseEngine;
  }>;
}

export async function listRetellPhoneNumbers(apiKey: string) {
  const response = await fetch(`${RETELL_API_BASE_URL}/list-phone-numbers`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(RETELL_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = await readRetellErrorPayload(response);
    console.error("[RETELL_LIST_PHONE_NUMBERS_ERROR]", {
      status: response.status,
      statusText: response.statusText,
      payload,
    });
    throw new Error("Unable to load Retell phone numbers");
  }

  return (await response.json()) as Array<{
    phone_number?: string | null;
    number?: string | null;
    inbound_agent_id?: string | null;
    outbound_agent_id?: string | null;
  }>;
}

export async function updateRetellAgentWebhookUrl(
  apiKey: string,
  agentId: string,
  webhookUrl: string,
) {
  const response = await fetch(`${RETELL_API_BASE_URL}/update-agent/${agentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhook_url: webhookUrl }),
    cache: "no-store",
    signal: AbortSignal.timeout(RETELL_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = await readRetellErrorPayload(response);
    console.error("[RETELL_WEBHOOK_UPDATE_ERROR]", {
      agentId,
      webhookUrl,
      status: response.status,
      statusText: response.statusText,
      payload,
    });
    throw new Error(
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : "Unable to update Retell webhook URL",
    );
  }
}

export async function ensureRetellAgentWebhookUrl(
  apiKey: string,
  agentId: string | undefined,
  teamId?: string,
) {
  if (!agentId) {
    return;
  }

  const { webhookUrl, environment } = await getRetellWebhookConfig(teamId);
  await logRetellWebhookUrl(teamId);
  console.log("[RETELL WEBHOOK URL] Sync context", {
    agentId,
    ...(await getRetellRuntimeDiagnostics(teamId)),
  });

  if (!webhookUrl) {
    console.warn(
      "[RETELL WEBHOOK URL] Webhook URL not configured",
    );
    return;
  }

  const syncKey = `${environment}:${agentId}:${webhookUrl}`;
  if (syncedWebhookAgentIds.has(syncKey)) {
    return;
  }

  await updateRetellAgentWebhookUrl(apiKey, agentId, webhookUrl);
  syncedWebhookAgentIds.add(syncKey);
  console.log(`[RETELL WEBHOOK URL] Updated Retell agent ${agentId}`);
}

export async function listRetellChatAgents(apiKey: string) {
  const response = await fetch(
    `${RETELL_API_BASE_URL}/list-chat-agents?is_latest=true&limit=100`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(RETELL_FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load Retell chat agents");
  }

  return (await response.json()) as Array<{
    agent_id?: string;
    version?: number;
    agent_name?: string | null;
    is_published?: boolean;
    webhook_url?: string | null;
    response_engine?: RetellResponseEngine;
  }>;
}

type RetellLlm = {
  begin_message?: string | null;
  general_prompt?: string | null;
  states?: Array<{
    name?: string;
    state_prompt?: string | null;
  }> | null;
};

type RetellConversationFlow = {
  global_prompt?: string | null;
  nodes?: Array<{
    id?: string;
    instruction?: {
      text?: string | null;
      prompt?: string | null;
    } | null;
  }> | null;
};

export async function getRetellLlmScript(
  apiKey: string,
  responseEngine: RetellResponseEngine | undefined,
) {
  if (responseEngine?.type !== "retell-llm" || !responseEngine.llm_id) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (typeof responseEngine.version === "number") {
    searchParams.set("version", String(responseEngine.version));
  }

  const query = searchParams.toString();
  const response = await fetch(
    `${RETELL_API_BASE_URL}/get-retell-llm/${responseEngine.llm_id}${query ? `?${query}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(RETELL_FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    return "";
  }

  const llm = (await response.json()) as RetellLlm;
  const scriptParts = [
    llm.begin_message ? `Opening message:\n${llm.begin_message}` : "",
    llm.general_prompt ? `General prompt:\n${llm.general_prompt}` : "",
    ...(llm.states ?? [])
      .filter((state) => state.state_prompt)
      .map((state) => `${state.name ?? "State"}:\n${state.state_prompt}`),
  ];

  return scriptParts.filter(Boolean).join("\n\n");
}

export async function getRetellConversationFlowScript(
  apiKey: string,
  responseEngine: RetellResponseEngine | undefined,
) {
  const conversationFlowId = responseEngine?.conversation_flow_id;
  if (
    !["conversation-flow", "conversation_flow"].includes(
      responseEngine?.type ?? "",
    ) ||
    !conversationFlowId
  ) {
    return "";
  }

  const response = await fetch(
    `${RETELL_API_BASE_URL}/get-conversation-flow/${conversationFlowId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(RETELL_FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    return "";
  }

  const flow = (await response.json()) as RetellConversationFlow;
  const scriptParts = [
    flow.global_prompt ? `Global prompt:\n${flow.global_prompt}` : "",
    ...(flow.nodes ?? [])
      .map((node) => ({
        id: node.id ?? "Node",
        text: node.instruction?.text ?? node.instruction?.prompt,
      }))
      .filter((node) => node.text)
      .map((node) => `${node.id}:\n${node.text}`),
  ];

  return scriptParts.filter(Boolean).join("\n\n");
}

export async function getRetellAgentScript(
  apiKey: string,
  responseEngine: RetellResponseEngine | undefined,
) {
  return (
    (await getRetellLlmScript(apiKey, responseEngine)) ||
    (await getRetellConversationFlowScript(apiKey, responseEngine))
  );
}

export async function getFirstRetellVoiceAgent(apiKey: string) {
  const agents = await listRetellAgents(apiKey);
  return (
    agents.find((agent) => agent.is_published && agent.agent_id) ??
    agents.find((agent) => agent.agent_id)
  );
}

export async function getFirstRetellChatAgent(apiKey: string) {
  const agents = await listRetellChatAgents(apiKey);
  return (
    agents.find((agent) => agent.is_published && agent.agent_id) ??
    agents.find((agent) => agent.agent_id)
  );
}
