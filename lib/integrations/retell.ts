import "server-only";
import type { IntegrationProvider } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/email-crypto";
import type { RetellSettings } from "./types";

const PROVIDER: IntegrationProvider = "RETELL";

export async function getRetellIntegration(userId?: string): Promise<RetellSettings | null> {
  const where: any = { provider: PROVIDER };
  if (userId) {
    where.userId = userId;
  }
  const integration = await prismadb.integration.findFirst({ where });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<RetellSettings, "apiKey"> & {
    apiKey: string;
  };

  return {
    ...settings,
    apiKey: decrypt(settings.apiKey),  
  };
}

export async function getRetellSettings(userId: string): Promise<RetellSettings | null> {
  const integration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<RetellSettings, "apiKey"> & {
    apiKey: string;
  };

  return {
    ...settings,
    apiKey: decrypt(settings.apiKey),
  };
}

export async function saveRetellSettings(
  userId: string,
  settings: RetellSettings
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

export async function testRetellSettings(settings: RetellSettings): Promise<boolean> {
  // Simple validation for now
  if (!settings.apiKey) {
    return false;
  }
  return true;
}

export function getMaskedRetellSettings(
  settings: RetellSettings
): Omit<RetellSettings, "apiKey"> & { apiKey: string } {
  return {
    ...settings,
    apiKey: "••••••••",
  };
}
