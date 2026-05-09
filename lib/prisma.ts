import { Prisma, PrismaClient } from "@prisma/client";
import { createMariaDbAdapter } from "./prisma-mariadb";

declare global {
  var cachedPrisma: PrismaClient | undefined;
  var cachedPrismaUrl: string | undefined;
  var cachedPrismaSchemaSignature: string | undefined;
  var cachedPrismaRuntimeVersion: string | undefined;
  var cachedPrismaResetPromise: Promise<void> | undefined;
}

const databaseUrl = process.env.DATABASE_URL;
const prismaRuntimeVersion = "mariadb-adapter-no-auto-disconnect-v1";

function getPrismaSchemaSignature() {
  return Prisma.dmmf.datamodel.models
    .map((model) => `${model.name}:${model.fields.map((field) => field.name).join(",")}`)
    .join("|");
}

// Prisma Client configuration with connection pooling.
const prismaClientSingleton = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Please provide DATABASE_URL environment variable.");
  }

  return new PrismaClient({
    adapter: createMariaDbAdapter(databaseUrl),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

let _prisma: PrismaClient | undefined;
const schemaSignature = getPrismaSchemaSignature();

async function disconnectClient(client?: PrismaClient) {
  if (!client) {
    return;
  }

  try {
    await client.$disconnect();
  } catch {
    // Swallow disconnect errors so callers can force a clean re-init.
  }
}

const getPrisma = (): PrismaClient => {
  if (process.env.NODE_ENV === "production") {
    if (!_prisma) {
      _prisma = prismaClientSingleton();
    }
    return _prisma;
  }

  const shouldRefreshClient =
    !global.cachedPrisma ||
    global.cachedPrismaUrl !== databaseUrl ||
    global.cachedPrismaSchemaSignature !== schemaSignature ||
    global.cachedPrismaRuntimeVersion !== prismaRuntimeVersion;

  if (shouldRefreshClient) {
    const previousClient = global.cachedPrisma;
    global.cachedPrisma = prismaClientSingleton();
    global.cachedPrismaUrl = databaseUrl;
    global.cachedPrismaSchemaSignature = schemaSignature;
    global.cachedPrismaRuntimeVersion = prismaRuntimeVersion;
    void disconnectClient(previousClient);
  }
  return global.cachedPrisma!;
};

export async function resetPrisma() {
  if (process.env.NODE_ENV === "production") {
    const current = _prisma;
    _prisma = undefined;
    await disconnectClient(current);
    return;
  }

  if (global.cachedPrismaResetPromise) {
    await global.cachedPrismaResetPromise;
    return;
  }

  const current = global.cachedPrisma;
  global.cachedPrisma = undefined;
  global.cachedPrismaUrl = undefined;
  global.cachedPrismaSchemaSignature = undefined;
  global.cachedPrismaRuntimeVersion = undefined;
  global.cachedPrismaResetPromise = disconnectClient(current).finally(() => {
    global.cachedPrismaResetPromise = undefined;
  });
  await global.cachedPrismaResetPromise;
}

export function isTransientPrismaConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("pool timeout: failed to retrieve a connection from pool") ||
    message.includes("read ECONNRESET") ||
    message.includes("pool is ending")
  );
}

export async function withPrismaRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) {
      throw error;
    }

    await resetPrisma();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return operation();
  }
}

// Use a proxy to lazily initialize the Prisma client only when accessed
export const prismadb = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (prop === "$disconnect") {
      return resetPrisma;
    }

    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
