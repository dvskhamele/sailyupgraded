"use server";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { testTwilioSettings } from "@/lib/integrations/twilio";
import { testResendSettings } from "@/lib/integrations/resend";
import { testRetellSettings } from "@/lib/integrations/retell";
import { testR2Settings } from "@/lib/integrations/r2";
import { testSmtp2goSettings } from "@/lib/integrations/smtp2go";
import type { IntegrationProvider } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await params;
    const providerUpper = provider.toUpperCase() as IntegrationProvider;
    const body = await request.json();

    let isValid: boolean;

    switch (providerUpper) {
      case "TWILIO":
        isValid = await testTwilioSettings(body);
        break;
      case "RESEND":
        isValid = await testResendSettings(body);
        break;
      case "RETELL":
        isValid = await testRetellSettings(body);
        break;
      case "R2":
        isValid = await testR2Settings(body);
        break;
      case "SMTP2GO":
        isValid = await testSmtp2goSettings(body);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid provider" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: isValid,
      message: isValid
        ? "Connected successfully"
        : "Failed to connect, please check your credentials",
    });
  } catch (error) {
    console.error("[INTEGRATION_TEST_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
