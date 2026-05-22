const RETELL_API_BASE_URL = "https://api.retellai.com";
const RETELL_FETCH_TIMEOUT_MS = 10000;

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

export function isE164PhoneNumber(phone: string) {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export function normalizeE164PhoneNumber(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  if (trimmed.startsWith("00")) {
    return `+${trimmed.slice(2).replace(/\D/g, "")}`;
  }

  return trimmed.replace(/[^\d+]/g, "");
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

export { RETELL_API_BASE_URL };
