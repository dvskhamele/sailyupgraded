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
  console.log("[getSmtp2goSettings] Called with userId:", userId);
  
  const integration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  console.log("[getSmtp2goSettings] Integration record found:", !!integration);
  if (integration) {
    console.log("[getSmtp2goSettings] Integration record:", JSON.stringify(integration, null, 2));
  }
  
  if (!integration) return null;

  const settings = integration.settings as unknown as Omit<Smtp2goSettings, "apiKey"> & {
    apiKey: string;
    api_key?: string; // For backward compatibility check!
  };
  
  console.log("[getSmtp2goSettings] Raw settings object:", JSON.stringify(settings, null, 2));
  
  // Check for both apiKey and api_key for backward compatibility!
  const encryptedKey = settings.apiKey || settings.api_key;
  console.log("[getSmtp2goSettings] Encrypted key present:", !!encryptedKey);
  
  if (!encryptedKey) {
    console.error("[getSmtp2goSettings] NO ENCRYPTED KEY FOUND IN SETTINGS!");
    return null;
  }

  let decryptedKey: string;
  try {
    let currentKey = encryptedKey;
    let attempts = 0;
    const maxAttempts = 5;
    
    // Keep decrypting until we get a plaintext key (starts with api-) OR we hit max attempts
    while (attempts < maxAttempts && currentKey.startsWith("api-") === false) {
      console.log(`[getSmtp2goSettings] Attempting decryption pass ${attempts + 1} on key:`, currentKey);
      currentKey = decrypt(currentKey);
      attempts++;
    }
    
    decryptedKey = currentKey;
    console.log("[getSmtp2goSettings] Final decrypted key:", decryptedKey);
  } catch (e) {
    console.error("[getSmtp2goSettings] Decryption FAILED!", e);
    return null;
  }

  const result = {
    ...settings,
    apiKey: decryptedKey,
  };
  
  console.log("[getSmtp2goSettings] Returning object:", JSON.stringify(result, null, 2));
  
  return result;
}

export async function saveSmtp2goSettings(
  userId: string,
  settings: Smtp2goSettings & { api_key?: string }
): Promise<void> {
  console.log("[saveSmtp2goSettings] Called with settings:", JSON.stringify(settings, null, 2));
  
  // Fetch existing integration if it exists
  const existingIntegration = await prismadb.integration.findFirst({
    where: {
      userId,
      provider: PROVIDER,
    },
  });

  console.log("[saveSmtp2goSettings] Existing integration found:", !!existingIntegration);
  
  let plaintextKey: string | null = null;
  
  // First check if we got a new plaintext key from settings
  const newKeyFromSettings = settings.apiKey || settings.api_key;
  if (newKeyFromSettings && newKeyFromSettings.startsWith("api-")) {
    plaintextKey = newKeyFromSettings;
    console.log("[saveSmtp2goSettings] Using new plaintext key from settings");
  } 
  // If no new plaintext key, use existing encrypted key as-is
  else if (existingIntegration?.settings) {
    const existingSettings = existingIntegration.settings as any;
    const existingEncryptedKey = existingSettings.apiKey || existingSettings.api_key;
    if (existingEncryptedKey) {
      console.log("[saveSmtp2goSettings] Preserving existing encrypted key as-is");
      
      // Build final settings with existing encrypted key
      const finalSettings = {
        ...existingSettings,
        ...settings,
        apiKey: existingEncryptedKey,
        api_key: existingEncryptedKey,
      };
      
      console.log("[saveSmtp2goSettings] Final settings to save:", JSON.stringify(finalSettings, null, 2));
      
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
          settings: finalSettings,
        },
        update: {
          settings: finalSettings,
        },
      });
      
      console.log("[saveSmtp2goSettings] Settings saved successfully!");
      return;
    }
  }
  
  // If we have a plaintext key to encrypt
  if (!plaintextKey) {
    console.error("[saveSmtp2goSettings] No valid apiKey or api_key provided!");
    throw new Error("apiKey is required");
  }
  
  // Encrypt the plaintext key ONCE
  const finalEncryptedKey = encrypt(plaintextKey);
  
  // Build final settings object
  const finalSettings = {
    ...(existingIntegration?.settings as object || {}),
    ...settings,
    apiKey: finalEncryptedKey,
    api_key: finalEncryptedKey,
  };
  
  console.log("[saveSmtp2goSettings] Final settings to save:", JSON.stringify(finalSettings, null, 2));
  
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
      settings: finalSettings,
    },
    update: {
      settings: finalSettings,
    },
  });
  
  console.log("[saveSmtp2goSettings] Settings saved successfully!");
}

export async function testSmtp2goSettings(settings: Smtp2goSettings): Promise<boolean> {
  // Simple validation for now
  if (!settings.apiKey) {
    return false;
  }
  return true;
}

export function getMaskedSmtp2goSettings(
  settings: Smtp2goSettings & { api_key?: string }
): Omit<Smtp2goSettings, "apiKey"> & { apiKey: string; api_key?: string } {
  return {
    ...settings,
    apiKey: "••••••••",
    api_key: "••••••••", // Backward compatibility
  };
}
