const RETELL_API_BASE_URL = "https://api.retellai.com";
const RETELL_FETCH_TIMEOUT_MS = 10000;
const RETELL_PRODUCTION_WEBHOOK_URL =
  "https://sailyupgraded.vercel.app/api/retell/webhook";

const syncedWebhookAgentIds = new Set<string>();

export type RetellResponseEngine = {
  type?: string;
  llm_id?: string;
  conversation_flow_id?: string;
  version?: number;
};

export type RetellAgent = {
  agent_id?: string;
  version?: number;
  agent_name?: string | null;
  is_published?: boolean;
  webhook_url?: string | null;
  response_engine?: RetellResponseEngine;
};

type RetellLlmState = {
  name?: string;
  state_prompt?: string | null;
};

type RetellLlm = {
  begin_message?: string | null;
  general_prompt?: string | null;
  states?: RetellLlmState[] | null;
};

type RetellConversationFlowNode = {
  id?: string;
  instruction?: {
    text?: string | null;
    prompt?: string | null;
  } | null;
};

type RetellConversationFlow = {
  global_prompt?: string | null;
  nodes?: RetellConversationFlowNode[] | null;
};

export function getRetellApiKey() {
  return process.env.RETELL_API_KEY ?? process.env.RETAIL_API_KEY;
}

export function getConfiguredAgentId() {
  return process.env.RETELL_AGENT_ID ?? process.env.RETAIL_AGENT_ID;
}

export function getConfiguredAgentVersion() {
  const value = process.env.RETELL_AGENT_VERSION ?? process.env.RETAIL_AGENT_VERSION;
  if (!value) {
    return undefined;
  }

  const version = Number(value);
  return Number.isInteger(version) ? version : undefined;
}

export function getConfiguredRetellPhoneNumber() {
  return process.env.RETELL_PHONE_NUMBER ?? process.env.RETAIL_PHONE_NUMBER;
}

export function getRetellWebhookConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const envWebhookUrl = process.env.RETELL_WEBHOOK_URL?.trim();
  const webhookUrl = isProduction ? RETELL_PRODUCTION_WEBHOOK_URL : envWebhookUrl;

  return {
    webhookUrl,
    environment: isProduction ? "production" : "development",
  };
}

export function logRetellWebhookUrl() {
  const { webhookUrl, environment } = getRetellWebhookConfig();
  console.log(
    `[RETELL WEBHOOK URL] ${webhookUrl || "not configured"} (${environment})`,
  );
}

export function isE164PhoneNumber(phone: string) {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export function normalizeE164PhoneNumber(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }

  let result = "";
  if (trimmed.startsWith("+")) {
    result = `+${trimmed.slice(1).replace(/\D/g, "")}`;
  } else if (trimmed.startsWith("00")) {
    result = `+${trimmed.slice(2).replace(/\D/g, "")}`;
  } else {
    result = trimmed.replace(/\D/g, "");
    // If it doesn't have a plus, we assume it's a full number without prefix or needs one.
    // Retell strictly requires + for E.164.
    if (result.length >= 10) {
      result = `+${result}`;
    }
  }

  return result;
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
    throw new Error("Unable to load Retell voice agents");
  }

  return (await response.json()) as RetellAgent[];
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
    const payload = await response.json().catch(() => undefined);
    throw new Error(
      payload?.message ?? payload?.error ?? "Unable to update Retell webhook URL",
    );
  }
}

export async function ensureRetellAgentWebhookUrl(
  apiKey: string,
  agentId: string | undefined,
) {
  if (!agentId) {
    return;
  }

  const { webhookUrl, environment } = getRetellWebhookConfig();
  logRetellWebhookUrl();

  if (!webhookUrl) {
    console.warn(
      "[RETELL WEBHOOK URL] RETELL_WEBHOOK_URL is required outside production",
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

  return (await response.json()) as RetellAgent[];
}

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

export { RETELL_API_BASE_URL };
