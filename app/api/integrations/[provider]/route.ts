"use server";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { saveTwilioSettings, testTwilioSettings } from "@/lib/integrations/twilio";
import { saveResendSettings, testResendSettings } from "@/lib/integrations/resend";
import { saveRetellSettings, testRetellSettings } from "@/lib/integrations/retell";
import { saveR2Settings, testR2Settings } from "@/lib/integrations/r2";
import { saveSmtp2goSettings, testSmtp2goSettings } from "@/lib/integrations/smtp2go";
import type { IntegrationProvider } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const userId = session.user.id as string;
    const { provider } = await params;
    const providerUpper = provider.toUpperCase() as IntegrationProvider;
    const body = await request.json();

    switch (providerUpper) {
      case "TWILIO":
        await saveTwilioSettings(userId, body);
        break;
      case "RESEND":
        await saveResendSettings(userId, body);
        break;
      case "RETELL":
        await saveRetellSettings(userId, body);
        break;
      case "R2":
        await saveR2Settings(userId, body);
        break;
      case "SMTP2GO":
        await saveSmtp2goSettings(userId, body);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid provider" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INTEGRATION_SAVE_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
