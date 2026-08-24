import { prismadb } from "@/lib/prisma";
import { decrypt } from "@/lib/email-crypto";
import { getOpenAIApiKey } from "@/lib/env";
import type { ApiKeyProvider } from "@prisma/client";

export type { ApiKeyProvider };

const PROVIDER_ENV_MAP: Record<ApiKeyProvider, string> = {
  OPENAI: "OPENAI_API_KEY",
  FIRECRAWL: "FIRECRAWL_API_KEY",
  ANTHROPIC: "ANTHROPIC_API_KEY",
  GROQ: "GROQ_API_KEY",
};

export function isPlaceholderKey(val: string | null | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed === "" ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "placeholder" ||
    trimmed === "your-api-key" ||
    trimmed === "your_api_key" ||
    trimmed === "your-openai-api-key" ||
    trimmed === "your_openai_api_key" ||
    trimmed === "sk-placeholder" ||
    trimmed === "sk-..." ||
    trimmed === "xxx" ||
    trimmed === "todo" ||
    trimmed.startsWith("your_") ||
    trimmed.startsWith("your-") ||
    trimmed.includes("placeholder")
  );
}

export function sanitizeApiKey(rawKey: string | null | undefined): string | null {
  if (!rawKey) return null;
  let cleaned = rawKey.trim();
  // Remove wrapping single or double quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Strip any trailing carriage return \r or whitespace
  cleaned = cleaned.replace(/[\r\n\t]/g, "").trim();

  if (isPlaceholderKey(cleaned) || cleaned.length < 5) {
    return null;
  }
  return cleaned;
}

export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "[none]";
  const sanitized = sanitizeApiKey(key);
  if (!sanitized) return "[invalid/placeholder]";
  if (sanitized.length <= 8) return "••••";
  return sanitized.slice(0, 3) + "••••" + sanitized.slice(-4);
}

/**
 * Retrieve all available sanitized candidate API keys in priority order:
 * 1. ENV variable (if set and not a placeholder)
 * 2. System-wide key stored in DB (scope=SYSTEM)
 * 3. User's personal key stored in DB (scope=USER) — only if userId provided
 */
export async function getAllApiKeys(
  provider: ApiKeyProvider,
  userId?: string
): Promise<string[]> {
  const candidates: string[] = [];

  // 1. ENV key
  const envRaw =
    provider === "OPENAI"
      ? getOpenAIApiKey()
      : process.env[PROVIDER_ENV_MAP[provider]];
  const envKey = sanitizeApiKey(envRaw);
  if (envKey) candidates.push(envKey);

  // 2. System-wide DB key
  try {
    const systemRow = await prismadb.apiKeys.findFirst({
      where: { scope: "SYSTEM", provider },
      select: { encryptedKey: true },
    });
    if (systemRow) {
      const decrypted = decrypt(systemRow.encryptedKey);
      const systemKey = sanitizeApiKey(decrypted);
      if (systemKey && !candidates.includes(systemKey)) {
        candidates.push(systemKey);
      }
    }
  } catch (err) {
    console.warn(`[getApiKey] Error reading SYSTEM key for ${provider}:`, err);
  }

  // 3. User-specific DB key
  if (userId) {
    try {
      const userRow = await prismadb.apiKeys.findFirst({
        where: { scope: "USER", userId, provider },
        select: { encryptedKey: true },
      });
      if (userRow) {
        const decrypted = decrypt(userRow.encryptedKey);
        const userKey = sanitizeApiKey(decrypted);
        if (userKey && !candidates.includes(userKey)) {
          candidates.push(userKey);
        }
      }
    } catch (err) {
      console.warn(`[getApiKey] Error reading USER key for ${provider}:`, err);
    }
  }

  return candidates;
}

/**
 * Resolve the primary API key using the priority chain:
 * 1. ENV variable (OPENAI_API_KEY etc.)
 * 2. System-wide key stored in DB (scope=SYSTEM)
 * 3. User's personal key stored in DB (scope=USER) — only if userId provided
 * 4. Returns null if no key found
 */
export async function getApiKey(
  provider: ApiKeyProvider,
  userId?: string
): Promise<string | null> {
  // Tier 1: ENV
  const envRaw =
    provider === "OPENAI"
      ? getOpenAIApiKey()
      : process.env[PROVIDER_ENV_MAP[provider]];
  const envKey = sanitizeApiKey(envRaw);
  if (envKey) return envKey;

  // Tier 2: system-wide DB key
  try {
    const systemRow = await prismadb.apiKeys.findFirst({
      where: { scope: "SYSTEM", provider },
      select: { encryptedKey: true },
    });
    if (systemRow) {
      const decrypted = decrypt(systemRow.encryptedKey);
      const systemKey = sanitizeApiKey(decrypted);
      if (systemKey) return systemKey;
    }
  } catch (err) {
    console.warn(`[getApiKey] Error reading SYSTEM key for ${provider}:`, err);
  }

  // Tier 3: user-specific DB key
  if (userId) {
    try {
      const userRow = await prismadb.apiKeys.findFirst({
        where: { scope: "USER", userId, provider },
        select: { encryptedKey: true },
      });
      if (userRow) {
        const decrypted = decrypt(userRow.encryptedKey);
        const userKey = sanitizeApiKey(decrypted);
        if (userKey) return userKey;
      }
    } catch (err) {
      console.warn(`[getApiKey] Error reading USER key for ${provider}:`, err);
    }
  }

  return null;
}
