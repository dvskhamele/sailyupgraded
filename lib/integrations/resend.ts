import "server-only";
import type { IntegrationProvider } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/email-crypto";
import type { ResendSettings } from "./types";

const PROVIDER: IntegrationProvider = "RESEND";

export async function getResendIntegration(userId?: string): Promise<ResendSettings | null> {
  const where: any = { provider: PROVIDER };
  if (userId) {
    where.userId = userId;
  }

  const integration = await prismadb.integration.findFirst({ where });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<ResendSettings, "apiKey"> & {
    apiKey: string;
  };

  return {
    ...settings,
    apiKey: decrypt(settings.apiKey),
  };
}

export async function getResendSettings(userId: string): Promise<ResendSettings | null> {
  const integration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<ResendSettings, "apiKey"> & {
    apiKey: string;
  };

  return {
    ...settings,
    apiKey: decrypt(settings.apiKey),
  };
}

export async function saveResendSettings(
  userId: string,
  settings: ResendSettings
): Promise<void> {
  const encryptedSettings = {
    ...settings,
    apiKey: encrypt(settings.apiKey),
  };

  await prismadb.integration.upsert({
    where: {
      userId_provider: {
        userId,
        provider: PROVIDER,
      },
    },
    create: {
      userId,
      provider: PROVIDER,
      settings: encryptedSettings,
    },
    update: {
      settings: encryptedSettings,
    },
  });
}

export async function testResendSettings(settings: ResendSettings): Promise<boolean> {
  // Simple validation for now - we'll implement actual Resend API test later
  if (!settings.apiKey || !settings.emailFrom) {
    return false;
  }
  return true;
}

export function getMaskedResendSettings(
  settings: ResendSettings
): Omit<ResendSettings, "apiKey"> & { apiKey: string } {
  return {
    ...settings,
    apiKey: "••••••••",
  };
}
