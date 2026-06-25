import "server-only";
import type { IntegrationProvider } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/email-crypto";
import type { Smtp2goSettings } from "./types";

const PROVIDER: IntegrationProvider = "SMTP2GO";

export async function getSmtp2goIntegration(userId?: string): Promise<Smtp2goSettings | null> {
  const where: any = { provider: PROVIDER };
  if (userId) {
    where.userId = userId;
  }

  const integration = await prismadb.integration.findFirst({ where });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<Smtp2goSettings, "apiKey"> & {
    apiKey: string;
  };

  return {
    ...settings,
    apiKey: decrypt(settings.apiKey),
  };
}

export async function getSmtp2goSettings(userId: string): Promise<Smtp2goSettings | null> {
  const integration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<Smtp2goSettings, "apiKey"> & {
    apiKey: string;
  };

  return {
    ...settings,
    apiKey: decrypt(settings.apiKey),
  };
}

export async function saveSmtp2goSettings(
  userId: string,
  settings: Smtp2goSettings
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

export async function testSmtp2goSettings(settings: Smtp2goSettings): Promise<boolean> {
  // Simple validation for now
  if (!settings.apiKey) {
    return false;
  }
  return true;
}

export function getMaskedSmtp2goSettings(
  settings: Smtp2goSettings
): Omit<Smtp2goSettings, "apiKey"> & { apiKey: string } {
  return {
    ...settings,
    apiKey: "••••••••",
  };
}
