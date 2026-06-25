import "server-only";
import type { IntegrationProvider } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/email-crypto";
import type { TwilioSettings } from "./types";

const PROVIDER: IntegrationProvider = "TWILIO";

export async function getTwilioIntegration(userId?: string): Promise<TwilioSettings | null> {
  const where: any = { provider: PROVIDER };
  if (userId) {
    where.userId = userId;
  }

  const integration = await prismadb.integration.findFirst({ where });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<TwilioSettings, "authToken"> & {
    authToken: string;
  };

  return {
    ...settings,
    authToken: decrypt(settings.authToken),
  };
}

export async function getTwilioSettings(userId: string): Promise<TwilioSettings | null> {
  const integration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<TwilioSettings, "authToken"> & {
    authToken: string;
  };

  return {
    ...settings,
    authToken: decrypt(settings.authToken),
  };
}

export async function saveTwilioSettings(
  userId: string,
  settings: TwilioSettings
): Promise<void> {
  const encryptedSettings = {
    ...settings,
    authToken: encrypt(settings.authToken),
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

export async function testTwilioSettings(settings: TwilioSettings): Promise<boolean> {
  // Simple validation for now - we'll implement actual Twilio API test later
  if (!settings.accountSid || !settings.authToken || !settings.phoneNumber) {
    return false;
  }
  return true;
}

export function getMaskedTwilioSettings(
  settings: TwilioSettings
): Omit<TwilioSettings, "authToken"> & { authToken: string } {
  return {
    ...settings,
    authToken: "••••••••",
  };
}
