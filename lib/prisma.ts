import { Prisma, PrismaClient } from "@prisma/client";
import { createMariaDbAdapter } from "./prisma-mariadb";

declare global {
  var cachedPrisma: PrismaClient | undefined;
  var cachedPrismaUrl: string | undefined;
  var cachedPrismaSchemaSignature: string | undefined;
  var cachedPrismaRuntimeVersion: string | undefined;
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
    global.cachedPrisma = prismaClientSingleton();
    global.cachedPrismaUrl = databaseUrl;
    global.cachedPrismaSchemaSignature = schemaSignature;
    global.cachedPrismaRuntimeVersion = prismaRuntimeVersion;
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

  const current = global.cachedPrisma;
  global.cachedPrisma = undefined;
  global.cachedPrismaUrl = undefined;
  global.cachedPrismaSchemaSignature = undefined;
  global.cachedPrismaRuntimeVersion = undefined;
  await disconnectClient(current);
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
