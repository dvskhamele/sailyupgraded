import { Prisma, PrismaClient } from "@prisma/client";
import { createMariaDbAdapter } from "./prisma-mariadb";

declare global {
  var cachedPrisma: PrismaClient | undefined;
  var cachedPrismaUrl: string | undefined;
  var cachedPrismaSchemaSignature: string | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

function getPrismaSchemaSignature() {
  return Prisma.dmmf.datamodel.models
    .map((model) => `${model.name}:${model.fields.map((field) => field.name).join(",")}`)
    .join("|");
}

// Prisma Client configuration with connection pooling and lifecycle management
const prismaClientSingleton = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new PrismaClient({
    adapter: createMariaDbAdapter(databaseUrl),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Ensure graceful shutdown on hot reload in development
  if (process.env.NODE_ENV !== "production") {
    // Clean up on process termination
    const cleanup = async () => {
      await client.$disconnect();
    };

    process.on("beforeExit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  return client;
};

let prisma: PrismaClient;
const schemaSignature = getPrismaSchemaSignature();

if (process.env.NODE_ENV === "production") {
  prisma = prismaClientSingleton();
} else {
  const shouldRefreshClient =
    !global.cachedPrisma ||
    global.cachedPrismaUrl !== databaseUrl ||
    global.cachedPrismaSchemaSignature !== schemaSignature;

  if (shouldRefreshClient) {
    global.cachedPrisma = prismaClientSingleton();
    global.cachedPrismaUrl = databaseUrl;
    global.cachedPrismaSchemaSignature = schemaSignature;
  }
  prisma = global.cachedPrisma!;
}

export const prismadb = prisma;
