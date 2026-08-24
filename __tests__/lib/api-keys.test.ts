/**
 * Tests for the 3-tier API key resolver.
 * Priority: ENV variable → SYSTEM key in DB → USER key in DB → null
 */
import {
  getApiKey,
  getAllApiKeys,
  sanitizeApiKey,
  maskApiKey,
  isPlaceholderKey,
} from "@/lib/api-keys";
import { prismadb } from "@/lib/prisma";
import { decrypt } from "@/lib/email-crypto";

// Mock prismadb to avoid real DB calls
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    apiKeys: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock email-crypto so we don't need EMAIL_ENCRYPTION_KEY in tests
jest.mock("@/lib/email-crypto", () => ({
  encrypt: jest.fn((s: string) => `enc:${s}`),
  decrypt: jest.fn((s: string) => s.replace("enc:", "")),
}));

const mockFindFirst = prismadb.apiKeys.findFirst as jest.Mock;

const TEST_USER_ID = "user-123";

beforeEach(() => {
  jest.clearAllMocks();
  // Clear any env vars set in environment or previous tests
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPEN_AI_API_KEY;
  delete process.env.OPENAI;
  delete process.env.FIRECRAWL_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GROQ_API_KEY;
});

describe("sanitizeApiKey & isPlaceholderKey", () => {
  it("detects placeholder values and rejects them", () => {
    expect(isPlaceholderKey("your-api-key")).toBe(true);
    expect(isPlaceholderKey("sk-placeholder")).toBe(true);
    expect(isPlaceholderKey("sk-...")).toBe(true);
    expect(isPlaceholderKey("")).toBe(true);
    expect(isPlaceholderKey("sk-validkey123456789")).toBe(false);
  });

  it("strips quotes and whitespace from valid keys", () => {
    expect(sanitizeApiKey(' "sk-12345678901234567890" ')).toBe("sk-12345678901234567890");
    expect(sanitizeApiKey("'sk-12345678901234567890'\r\n")).toBe("sk-12345678901234567890");
  });

  it("masks keys safely without exposing full secret", () => {
    expect(maskApiKey("sk-proj-1234567890abcdef")).toBe("sk-••••cdef");
    expect(maskApiKey(null)).toBe("[none]");
  });
});

describe("getApiKey — tier 1: ENV variable", () => {
  it("returns ENV value immediately when set and valid, skipping DB", async () => {
    process.env.OPENAI_API_KEY = "env-key-abcdefghijk";
    const result = await getApiKey("OPENAI", TEST_USER_ID);
    expect(result).toBe("env-key-abcdefghijk");
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("maps providers to correct env var names", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-key-xyz12345678";
    const result = await getApiKey("FIRECRAWL", TEST_USER_ID);
    expect(result).toBe("fc-key-xyz12345678");
  });

  it("ignores placeholder env values and falls back to DB", async () => {
    process.env.OPENAI_API_KEY = "your-api-key";
    mockFindFirst.mockResolvedValueOnce({ encryptedKey: "enc:db-system-key-12345" });

    const result = await getApiKey("OPENAI", TEST_USER_ID);
    expect(result).toBe("db-system-key-12345");
  });
});

describe("getApiKey — tier 2: SYSTEM key in DB", () => {
  it("returns decrypted system key when no ENV set", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ encryptedKey: "enc:system-key-12345" }); // system lookup

    const result = await getApiKey("OPENAI", TEST_USER_ID);
    expect(result).toBe("system-key-12345");
    // Should have queried for SYSTEM scope first
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scope: "SYSTEM", provider: "OPENAI" }),
      })
    );
  });
});

describe("getApiKey — tier 3: USER key in DB", () => {
  it("returns decrypted user key when no ENV and no system key", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null) // system lookup → not found
      .mockResolvedValueOnce({ encryptedKey: "enc:user-key-12345" }); // user lookup

    const result = await getApiKey("OPENAI", TEST_USER_ID);
    expect(result).toBe("user-key-12345");
  });

  it("skips user lookup when userId not provided", async () => {
    mockFindFirst.mockResolvedValueOnce(null); // system lookup

    const result = await getApiKey("OPENAI");
    expect(result).toBeNull();
    expect(mockFindFirst).toHaveBeenCalledTimes(1); // only system lookup
  });
});

describe("getApiKey — tier 4: null", () => {
  it("returns null when no key found at any tier", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await getApiKey("OPENAI", TEST_USER_ID);
    expect(result).toBeNull();
  });
});
