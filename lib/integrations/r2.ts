import "server-only";
import type { IntegrationProvider } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/email-crypto";
import type { R2Settings } from "./types";

const PROVIDER: IntegrationProvider = "R2";

export async function getR2Integration(userId?: string): Promise<R2Settings | null> {
  const where: any = { provider: PROVIDER };
  if (userId) {
    where.userId = userId;
  }

  const integration = await prismadb.integration.findFirst({ where });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<R2Settings, "secretKey"> & {
    secretKey: string;
  };

  return {
    ...settings,
    secretKey: decrypt(settings.secretKey),
  };
}

export async function getR2Settings(userId: string): Promise<R2Settings | null> {
  const integration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<R2Settings, "secretKey"> & {
    secretKey: string;
  };

  return {
    ...settings,
    secretKey: decrypt(settings.secretKey),
  };
}

export async function saveR2Settings(
  userId: string,
  settings: R2Settings
): Promise<void> {
  const encryptedSettings = {
    ...settings,
    secretKey: encrypt(settings.secretKey),
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

export async function testR2Settings(settings: R2Settings): Promise<boolean> {
  // Simple validation for now
  if (!settings.accountId || !settings.accessKey || !settings.secretKey || !settings.bucketName) {
    return false;
  }
  return true;
}

export function getMaskedR2Settings(
  settings: R2Settings
): Omit<R2Settings, "secretKey"> & { secretKey: string } {
  return {
    ...settings,
    secretKey: "••••••••",
  };
}
