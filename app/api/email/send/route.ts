import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import {
  DEFAULT_SMTP2GO_SENDER,
  isAllowedSmtp2GoSender,
  normalizeSenderEmail,
  SMTP2GO_SENDER_DOMAIN_ERROR,
} from "@/lib/email/sender-policy";
import { sendSmtp2GoEmail } from "@/lib/email/smtp2go";

export const runtime = "nodejs";

const emailSchema = z.object({
  from: z.string().trim().optional(),
  recipients: z
    .array(z.string().trim().email())
    .min(1, "At least one recipient is required."),
  subject: z.string().trim().min(1, "Subject is required."),
  message: z.string().trim().min(1, "Message is required."),
});

export async function POST(request: Request) {
  console.log("POST /api/email/send received");

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = emailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email payload." },
      { status: 400 }
    );
  }

  const { recipients, subject, message } = parsed.data;
  const from = normalizeSenderEmail(parsed.data.from || DEFAULT_SMTP2GO_SENDER);
  const uniqueRecipients = Array.from(new Set(recipients.map((email) => email.toLowerCase())));

  if (!isAllowedSmtp2GoSender(from)) {
    console.warn("SMTP2GO sender rejected before API call:", from);
    return NextResponse.json(
      { error: SMTP2GO_SENDER_DOMAIN_ERROR },
      { status: 400 }
    );
  }

  console.log(
    "EMAIL SEND REQUEST:",
    JSON.stringify(
      {
        from,
        recipientCount: uniqueRecipients.length,
        recipients: uniqueRecipients,
        subject,
        messageLength: message.length,
      },
      null,
      2
    )
  );

  const results = [];
  for (const recipient of uniqueRecipients) {
    results.push(await sendSmtp2GoEmail({ userId: session.user.id, from, recipient, subject, message }));
  }

  const failed = results.filter((result) => !result.success);
  const sent = results.length - failed.length;

  return NextResponse.json(
    {
      error: failed.length > 0 ? `${failed.length} email(s) failed to send.` : undefined,
      sent,
      failed: failed.length,
      failures: failed.map(({ recipient, error, status, response }) => ({
        recipient,
        error,
        status,
        response,
      })),
    },
    { status: sent > 0 || failed.length === 0 ? 200 : 502 }
  );
}
