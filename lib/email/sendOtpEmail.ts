import { Resend } from "resend";
import { getEmailFromAddress, getResendApiKey } from "@/lib/env";

const OTP_REGEX = /^\d{6}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DEFAULT_TIMEOUT_MS = 10_000;

export type SendOtpEmailInput = {
  email: string;
  otp: string;
  timeoutMs?: number;
};

export type SendOtpEmailResult = {
  success: boolean;
  message: string;
  data?: {
    id?: string;
    email: string;
    from: string;
    subject: string;
    provider: "resend";
  };
  error?: {
    code: string;
    message: string;
  };
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function buildOtpHtml({
  appName,
  email,
  otp,
}: {
  appName: string;
  email: string;
  otp: string;
}) {
  const safeAppName = escapeHtml(appName);
  const safeEmail = escapeHtml(email);
  const safeOtp = escapeHtml(otp);

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${safeAppName} verification code</title>
    </head>
    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
          <p style="margin:0 0 12px;font-size:14px;line-height:20px;color:#6b7280;">${safeAppName}</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;color:#111827;">Your login verification code</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#374151;">
            Use the code below to sign in for <strong>${safeEmail}</strong>.
          </p>
          <div style="display:inline-block;padding:16px 24px;border-radius:10px;background:#f3f4f6;border:1px solid #d1d5db;font-size:32px;line-height:40px;letter-spacing:8px;font-weight:700;color:#111827;">
            ${safeOtp}
          </div>
          <p style="margin:24px 0 0;font-size:14px;line-height:20px;color:#6b7280;">
            This code expires in 5 minutes. If you did not request it, you can ignore this email.
          </p>
        </div>
      </div>
    </body>
  </html>`;
}

function buildOtpText({ appName, email, otp }: { appName: string; email: string; otp: string }) {
  return [
    `${appName}`,
    "",
    `Your login verification code is: ${otp}`,
    "",
    `Account: ${email}`,
    "This code expires in 5 minutes.",
    "If you did not request it, please ignore this email.",
  ].join("\n");
}

export async function sendOtpEmail(
  input: SendOtpEmailInput
): Promise<SendOtpEmailResult> {
  const email = input.email.trim().toLowerCase();
  const otp = input.otp.trim();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "NextCRM";

  console.info("[OTP EMAIL] Request received", {
    email,
    otpLength: otp.length,
    timeoutMs,
  });

  if (!EMAIL_REGEX.test(email)) {
    console.error("[OTP EMAIL] Invalid email format", { email });
    throw new Error("Invalid email address.");
  }

  if (!otp) {
    console.error("[OTP EMAIL] Missing OTP value", { email });
    throw new Error("OTP is required.");
  }

  if (!OTP_REGEX.test(otp)) {
    console.error("[OTP EMAIL] Invalid OTP format", { email, otpLength: otp.length });
    throw new Error("Invalid OTP format.");
  }

  const apiKey = getResendApiKey();
  const fromAddress = getEmailFromAddress();

  if (!apiKey) {
    console.error("[OTP EMAIL] Missing RESEND_API_KEY", { email });
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!fromAddress) {
    console.error("[OTP EMAIL] Missing EMAIL_FROM", { email });
    throw new Error("Missing EMAIL_FROM.");
  }

  const resend = new Resend(apiKey);
  const subject = `${appName} verification code`;
  const html = buildOtpHtml({ appName, email, otp });
  const text = buildOtpText({ appName, email, otp });

  try {
    // TODO: Add rate limiting here by IP/email before calling the provider.
    const { data, error } = await withTimeout(
      resend.emails.send({
        from: `${appName} <${fromAddress}>`,
        to: email,
        subject,
        html,
        text,
      }),
      timeoutMs,
      "Resend OTP delivery"
    );

    if (error) {
      console.error("[RESEND ERROR]", error);
      throw new Error(error.message);
    }

    console.info("[RESEND SUCCESS]", {
      id: data?.id,
      email,
      provider: "resend",
    });

    return {
      success: true,
      message: "OTP email sent successfully.",
      data: {
        id: data?.id,
        email,
        from: `${appName} <${fromAddress}>`,
        subject,
        provider: "resend",
      },
    };
  } catch (error) {
    console.error("[OTP EMAIL] Delivery failure", {
      email,
      error,
    });
    throw error instanceof Error ? error : new Error("Unable to send OTP right now.");
  }
}
