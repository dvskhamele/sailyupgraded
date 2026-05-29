const RETELL_API_BASE_URL = "https://api.retellai.com";
const RETELL_FETCH_TIMEOUT_MS = 10000;
const RETELL_PRODUCTION_WEBHOOK_URL =
  "https://sailyupgraded.vercel.app/api/retell/webhook";

const syncedWebhookAgentIds = new Set<string>();

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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

export type RetellPhoneNumber = {
  phone_number?: string | null;
  number?: string | null;
  inbound_agent_id?: string | null;
  outbound_agent_id?: string | null;
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
  return cleanEnv(process.env.RETELL_API_KEY) ?? cleanEnv(process.env.RETAIL_API_KEY);
}

export function getRetellApiKeySource() {
  if (cleanEnv(process.env.RETELL_API_KEY)) return "RETELL_API_KEY";
  if (cleanEnv(process.env.RETAIL_API_KEY)) return "RETAIL_API_KEY";
  return "missing";
}

export function fingerprintSecret(value: string | undefined) {
  if (value === undefined) return "missing";
  if (!value.trim()) return "empty";
  return `prefix=${value.slice(0, 6)} len=${value.length}`;
}

export function getRetellRuntimeDiagnostics(apiKey = getRetellApiKey()) {
  const { webhookUrl, environment } = getRetellWebhookConfig();

  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    environment,
    productionModeActive: process.env.NODE_ENV === "production",
    webhookUrl: webhookUrl || null,
    apiKeySource: getRetellApiKeySource(),
    apiKeyFingerprint: fingerprintSecret(apiKey),
    retellApiKeyFingerprint: fingerprintSecret(process.env.RETELL_API_KEY),
    retailApiKeyFingerprint: fingerprintSecret(process.env.RETAIL_API_KEY),
    configuredAgentId: getConfiguredAgentId() || null,
    configuredAgentVersion: getConfiguredAgentVersion() ?? null,
    retellWorkspaceIdentifier:
      process.env.RETELL_WORKSPACE_ID ??
      process.env.RETELL_ACCOUNT_ID ??
      process.env.RETAIL_WORKSPACE_ID ??
      process.env.RETAIL_ACCOUNT_ID ??
      null,
    hasRetellWebhookUrl: Boolean(process.env.RETELL_WEBHOOK_URL?.trim()),
    phoneNumberFingerprint: fingerprintSecret(getConfiguredRetellPhoneNumber()),
  };
}

export function getConfiguredAgentId() {
  return cleanEnv(process.env.RETELL_AGENT_ID) ?? cleanEnv(process.env.RETAIL_AGENT_ID);
}

export function getConfiguredAgentVersion() {
  const value =
    cleanEnv(process.env.RETELL_AGENT_VERSION) ??
    cleanEnv(process.env.RETAIL_AGENT_VERSION);
  if (!value) {
    return undefined;
  }

  const version = Number(value);
  return Number.isInteger(version) ? version : undefined;
}

export function getConfiguredRetellPhoneNumber() {
  return (
    cleanEnv(process.env.RETELL_PHONE_NUMBER) ??
    cleanEnv(process.env.RETAIL_PHONE_NUMBER)
  );
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

async function readRetellErrorPayload(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
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
    const payload = await readRetellErrorPayload(response);
    console.error("[RETELL_LIST_AGENTS_ERROR]", {
      status: response.status,
      statusText: response.statusText,
      payload,
    });
    throw new Error("Unable to load Retell voice agents");
  }

  return (await response.json()) as RetellAgent[];
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

  return (await response.json()) as RetellPhoneNumber[];
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
) {
  if (!agentId) {
    return;
  }

  const { webhookUrl, environment } = getRetellWebhookConfig();
  logRetellWebhookUrl();
  console.log("[RETELL WEBHOOK URL] Sync context", {
    agentId,
    ...getRetellRuntimeDiagnostics(apiKey),
  });

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
