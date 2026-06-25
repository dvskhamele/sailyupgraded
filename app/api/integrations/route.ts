"use server";

import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { getMaskedTwilioSettings } from "@/lib/integrations/twilio";
import { getMaskedResendSettings } from "@/lib/integrations/resend";
import { getMaskedRetellSettings } from "@/lib/integrations/retell";
import { getMaskedR2Settings } from "@/lib/integrations/r2";
import { getMaskedSmtp2goSettings } from "@/lib/integrations/smtp2go";
import type { IntegrationProvider } from "@prisma/client";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const userId = session.user.id as string;

    const integrations = await prismadb.integration.findMany({
      where: { userId },
    });

    const result: {
      [key in IntegrationProvider]?: {
        connected: boolean;
        [key: string]: any;
      };
    } = {};

    for (const integration of integrations) {
      let settings: any;

      switch (integration.provider) {
        case "TWILIO":
          settings = getMaskedTwilioSettings(integration.settings as any);
          result.TWILIO = { connected: true, ...settings };
          break;
        case "RESEND":
          settings = getMaskedResendSettings(integration.settings as any);
          result.RESEND = { connected: true, ...settings };
          break;
        case "RETELL":
          settings = getMaskedRetellSettings(integration.settings as any);
          result.RETELL = { connected: true, ...settings };
          break;
        case "R2":
          settings = getMaskedR2Settings(integration.settings as any);
          result.R2 = { connected: true, ...settings };
          break;
        case "SMTP2GO":
          settings = getMaskedSmtp2goSettings(integration.settings as any);
          result.SMTP2GO = { connected: true, ...settings };
          break;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[INTEGRATIONS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
