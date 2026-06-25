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
