import {
  isAllowedSmtp2GoSender,
  normalizeSenderEmail,
  SMTP2GO_SENDER_DOMAIN_ERROR,
} from "@/lib/email/sender-policy";

import { getSmtp2goSettings } from "@/lib/integrations/smtp2go";

type Smtp2GoSendInput = {
    userId: string;
  from: string;
  recipient: string;
  subject: string;
  message: string;
};

type Smtp2GoSendResult = {
  recipient: string;
  success: boolean;
  error?: string;
  status?: number;
  response?: unknown;
};

const SMTP2GO_SEND_URL = "https://api.smtp2go.com/v3/email/send";

function getSmtp2GoError(response: unknown) {
  if (!response || typeof response !== "object") {
    return "SMTP2GO returned an unexpected response.";
  }

  const data = response as {
    result?: string;
    data?: {
      error_code?: string;
      error?: string;
      errors?: string[];
      failures?: unknown[];
      failed?: number;
    };
    error?: string;
    message?: string;
  };

  if (data.error) return data.error;
  if (data.message) return data.message;
  if (data.data?.error) return data.data.error;
  if (data.data?.error_code) return data.data.error_code;
  if (data.data?.errors?.length) return data.data.errors.join(", ");
  if (data.data?.failures?.length) {
    return `SMTP2GO reported recipient failures: ${JSON.stringify(data.data.failures)}`;
  }
  if (data.data?.failed && data.data.failed > 0) {
    return `SMTP2GO reported ${data.data.failed} failed recipient(s).`;
  }

  return data.result && data.result !== "success"
    ? `SMTP2GO returned ${data.result}.`
    : "SMTP2GO failed to send the email.";
}

function isSmtp2GoSuccess(response: Response, payload: unknown) {
  if (!response.ok || !payload || typeof payload !== "object") return false;

  const data = payload as {
    result?: string;
    data?: {
      succeeded?: number;
      failed?: number;
      failures?: unknown[];
      email_id?: string;
    };
  };

  if (data.result === "success") return true;
  if (typeof data.data?.succeeded === "number") {
    return data.data.succeeded > 0 && (data.data.failed ?? 0) === 0;
  }

  return Boolean(data.data?.email_id);
}

export async function sendSmtp2GoEmail({
    userId,
  from,
  recipient,
  subject,
  message,
}: Smtp2GoSendInput): Promise<Smtp2GoSendResult> {
  console.log("[sendSmtp2GoEmail] Called with userId:", userId);
  
  const normalizedFrom = normalizeSenderEmail(from);
  console.log("[sendSmtp2GoEmail] Normalized from:", normalizedFrom);

  if (!isAllowedSmtp2GoSender(normalizedFrom)) {
    console.warn("SMTP2GO sender rejected before API call:", normalizedFrom);
    return {
      recipient,
      success: false,
      error: SMTP2GO_SENDER_DOMAIN_ERROR,
    };
  }

  console.log("[sendSmtp2GoEmail] Calling getSmtp2goSettings...");
  const smtp = await getSmtp2goSettings(userId);
  console.log("[sendSmtp2GoEmail] getSmtp2goSettings returned:", smtp ? JSON.stringify(smtp, null, 2) : "null");

  if (!smtp) {
  console.error("[sendSmtp2GoEmail] SMTP2GO settings not found!");
  return {
    recipient,
    success: false,
    error: "SMTP2GO settings not found",
  };
}

  const apiKey = smtp.apiKey; // We know smtp exists now
  console.log("[sendSmtp2GoEmail] smtp object:", smtp);
  console.log("[sendSmtp2GoEmail] smtp.apiKey:", smtp.apiKey);
  console.log("[sendSmtp2GoEmail] Final apiKey variable:", apiKey);
  console.log("SMTP2GO API KEY PRESENT:", Boolean(apiKey));

  if (!apiKey) {
    console.error("SMTP2GO ERROR: SMTP2GO_API_KEY is not configured.");
    return {
      recipient,
      success: false,
      error: "SMTP2GO_API_KEY is not configured.",
    };
  }

  const requestBody = {
    sender: normalizedFrom,
    to: [recipient],
    subject,
    text_body: message,
  };

  console.log("SMTP2GO REQUEST:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(SMTP2GO_SEND_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let payload: unknown = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = responseText;
    }

    console.log("SMTP2GO STATUS:", response.status);
    console.log(
      "SMTP2GO RESPONSE:",
      typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
    );

    if (!isSmtp2GoSuccess(response, payload)) {
      const error = getSmtp2GoError(payload);
      console.error("SMTP2GO SEND FAILED:", error);
      return {
        recipient,
        success: false,
        error,
        status: response.status,
        response: payload,
      };
    }

    return {
      recipient,
      success: true,
      status: response.status,
      response: payload,
    };
  } catch (error) {
    console.error("SMTP2GO EXCEPTION:", error);
    return {
      recipient,
      success: false,
      error: error instanceof Error ? error.message : "Failed to call SMTP2GO.",
    };
  }
}

export type { Smtp2GoSendResult };
