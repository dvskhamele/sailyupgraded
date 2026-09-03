import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type { PoolConfig } from "mariadb";

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 300;
const DEFAULT_CONNECTION_LIMIT = 25;

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseUrlNumber(url: URL, ...keys: string[]) {
  for (const key of keys) {
    const parsed = parseNumber(url.searchParams.get(key));
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
}

function parseSslOption(url: URL): PoolConfig["ssl"] {
  const sslAccept = url.searchParams.get("sslaccept");
  const sslMode = url.searchParams.get("sslmode");
  const isTiDbCloudHost = url.hostname.endsWith(".tidbcloud.com");

  if (!sslAccept && !sslMode && !isTiDbCloudHost) {
    return undefined;
  }

  const strictSsl =
    sslAccept === "strict" ||
    sslAccept === "required" ||
    sslAccept === "verify-full" ||
    sslMode === "require" ||
    sslMode === "verify-ca" ||
    sslMode === "verify-full" ||
    isTiDbCloudHost;

  return {
    rejectUnauthorized: strictSsl,
    minVersion: "TLSv1.2",
  } as PoolConfig["ssl"];
}

export function createMariaDbConfigFromUrl(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);

  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error(
      `Unsupported DATABASE_URL protocol "${url.protocol}". Expected mysql: or mariadb:.`
    );
  }

  return {
    host: url.hostname,
    port: parseNumber(url.port) ?? 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\/+/, "") || undefined,
    connectTimeout:
      parseUrlNumber(url, "connect_timeout", "connectTimeout") ??
      DEFAULT_CONNECT_TIMEOUT_MS,
    acquireTimeout:
      parseUrlNumber(url, "acquire_timeout", "acquireTimeout", "pool_timeout") ??
      DEFAULT_ACQUIRE_TIMEOUT_MS,
    initializationTimeout:
      parseUrlNumber(url, "initialization_timeout", "initializationTimeout") ??
      DEFAULT_ACQUIRE_TIMEOUT_MS - 100,
    idleTimeout:
      parseUrlNumber(url, "max_idle_connection_lifetime", "idle_timeout", "idleTimeout") ??
      DEFAULT_IDLE_TIMEOUT_SECONDS,
    connectionLimit:
      parseUrlNumber(url, "connection_limit", "connectionLimit") ??
      DEFAULT_CONNECTION_LIMIT,
    ssl: parseSslOption(url),
  };
}

export function createMariaDbAdapter(databaseUrl: string) {
  return new PrismaMariaDb(createMariaDbConfigFromUrl(databaseUrl) as any);
}
