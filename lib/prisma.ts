import { Prisma, PrismaClient } from "@prisma/client";
import { getOrganizationContext } from "@/lib/organization-context";
import { createMariaDbAdapter } from "./prisma-mariadb";

declare global {
  var cachedPrisma: PrismaClient | undefined;
  var cachedPrismaUrl: string | undefined;
  var cachedPrismaSchemaSignature: string | undefined;
  var cachedPrismaRuntimeVersion: string | undefined;
  var cachedPrismaResetPromise: Promise<void> | undefined;
  var cachedPrismaQueryStats: { activeQueries: number } | undefined;
}

const databaseUrl = process.env.DATABASE_URL;
const prismaRuntimeVersion = "mariadb-adapter-singleton-v4";
const slowQueryThresholdMs = Number(process.env.PRISMA_SLOW_QUERY_MS ?? 1000);
const transactionMaxWaitMs = Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS ?? 10_000);
const transactionTimeoutMs = Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS ?? 30_000);

const organizationScopedModels = new Set([
  "crm_Accounts",
  "crm_Leads",
  "crm_Contact_Enrichment",
  "crm_Target_Enrichment",
  "crm_Target_Contact",
  "crm_Opportunities",
  "crm_LeadCallTracking",
  "crm_LeadCallWebhookEvent",
  "crm_campaigns",
  "crm_campaign_templates",
  "crm_campaign_steps",
  "crm_campaign_sends",
  "crm_Contacts",
  "crm_Contracts",
  "crm_SystemSettings",
  "crm_Activities",
  "crm_ActivityLinks",
  "crm_RetailAIActivities",
  "crm_RetailAIActivityLinks",
  "Boards",
  "Documents",
  "Documents_Types",
  "Sections",
  "Tasks",
  "crm_Accounts_Tasks",
  "tasksComments",
  "crm_AuditLog",
  "crm_Report_Config",
  "crm_Report_Schedule",
  "DocumentsToOpportunities",
  "DocumentsToContacts",
  "DocumentsToTasks",
  "DocumentsToCrmAccountsTasks",
  "DocumentsToLeads",
  "DocumentsToAccounts",
  "ContactsToOpportunities",
  "crm_Targets",
  "crm_TargetLists",
  "TargetsToTargetLists",
  "EmailAccount",
  "Email",
  "EmailsToContacts",
  "EmailsToAccounts",
  "crm_ProductCategories",
  "crm_Products",
  "crm_AccountProducts",
  "crm_OpportunityLineItems",
  "crm_ContractLineItems",
  "Invoices",
  "Invoice_LineItems",
  "Invoice_Payments",
  "Invoice_Attachments",
  "Invoice_Activity",
  "Invoice_TaxRates",
  "Invoice_Series",
  "Invoice_Settings",
  "crm_SMSLog",
]);

const whereOperations = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

const createOperations = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "upsert",
]);

const unscopedNestedCreateRelationKeys = new Set([
  "target_lists",
  "watchers",
]);

function addOrganizationWhere(args: Record<string, any>, organizationId: string) {
  args.where = {
    ...(args.where ?? {}),
    organizationId,
  };
}

function addOrganizationToCreateData(data: unknown, organizationId: string) {
  if (Array.isArray(data)) {
    for (const item of data) {
      addOrganizationToCreateData(item, organizationId);
    }
    return;
  }

  if (!data || typeof data !== "object") {
    return;
  }

  const record = data as Record<string, unknown>;
  record.organizationId = organizationId;

  for (const [key, value] of Object.entries(record)) {
    if (unscopedNestedCreateRelationKeys.has(key)) {
      continue;
    }

    if (!value || typeof value !== "object") {
      continue;
    }

    const nested = value as Record<string, unknown>;
    if ("create" in nested) {
      addOrganizationToCreateData(nested.create, organizationId);
    }

    if ("createMany" in nested && nested.createMany && typeof nested.createMany === "object") {
      const createMany = nested.createMany as Record<string, unknown>;
      addOrganizationToCreateData(createMany.data, organizationId);
    }

    if ("upsert" in nested) {
      const upserts = Array.isArray(nested.upsert) ? nested.upsert : [nested.upsert];
      for (const upsert of upserts) {
        if (upsert && typeof upsert === "object") {
          addOrganizationToCreateData((upsert as Record<string, unknown>).create, organizationId);
        }
      }
    }
  }
}

function getExplicitOrganizationId(args: Record<string, any> | undefined) {
  const candidates = [
    args?.where?.organizationId,
    args?.data?.organizationId,
    args?.create?.organizationId,
    args?.update?.organizationId,
  ];

  return candidates.find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
  ) ?? null;
}

function scopeOrganizationArgs(
  model: string | undefined,
  operation: string,
  args: Record<string, any> | undefined,
) {
  if (!model || !organizationScopedModels.has(model)) {
    return args ?? {};
  }

  const explicitOrgId = getExplicitOrganizationId(args);
  const contextOrgId = getOrganizationContext();
  let organizationId = contextOrgId ?? explicitOrgId;
  
  // If we still don't have organizationId, throw an error
  if (!organizationId) {
    console.error("[ORG_CONTEXT_MISSING]", {
      model,
      operation,
      args,
      contextOrgId,
      explicitOrgId,
    });
    throw new Error(
      `Organization context is required for ${String(model)}.${String(operation)}`,
    );
  }

  const nextArgs = args ?? {};

  if (whereOperations.has(operation)) {
    addOrganizationWhere(nextArgs, organizationId);
  }

  if (createOperations.has(operation)) {
    if (operation === "upsert") {
      addOrganizationToCreateData(nextArgs.create, organizationId);
      addOrganizationToCreateData(nextArgs.update, organizationId);
    } else {
      addOrganizationToCreateData(nextArgs.data, organizationId);
    }
  }

  return nextArgs;
}

export function getDatabaseUrlDiagnostics() {
  if (!databaseUrl) {
    return {
      configured: false,
      protocol: null,
      host: null,
      port: null,
      database: null,
      username: null,
      sslaccept: null,
      sslmode: null,
    };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      configured: true,
      protocol: url.protocol.replace(/:$/, ""),
      host: url.hostname,
      port: url.port || (url.protocol === "mysql:" || url.protocol === "mariadb:" ? "3306" : null),
      database: url.pathname.replace(/^\/+/, "") || null,
      username: url.username ? decodeURIComponent(url.username) : null,
      sslaccept: url.searchParams.get("sslaccept"),
      sslmode: url.searchParams.get("sslmode"),
    };
  } catch (error) {
    return {
      configured: true,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function getPrismaSchemaSignature() {
  return Prisma.dmmf.datamodel.models
    .map((model) => `${model.name}:${model.fields.map((field) => field.name).join(",")}`)
    .join("|");
}

function getQueryStats() {
  if (!global.cachedPrismaQueryStats) {
    global.cachedPrismaQueryStats = { activeQueries: 0 };
  }
  return global.cachedPrismaQueryStats;
}

// Prisma Client configuration with connection pooling.
const prismaClientSingleton = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Please provide DATABASE_URL environment variable.");
  }

  const client = new PrismaClient({
    adapter: createMariaDbAdapter(databaseUrl),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: transactionMaxWaitMs,
      timeout: transactionTimeoutMs,
    },
  });

  return client.$extends({
    query: {
      $allModels: {
        $allOperations: async ({ model, operation, args, query }) => {
          const stats = getQueryStats();
          const startedAt = Date.now();
          stats.activeQueries += 1;

          try {
            return await query(
              scopeOrganizationArgs(model, operation, args as Record<string, any>),
            );
          } finally {
            const elapsedMs = Date.now() - startedAt;
            stats.activeQueries = Math.max(0, stats.activeQueries - 1);

            if (elapsedMs >= slowQueryThresholdMs) {
              console.warn(
                `[Prisma slow query] ${model}.${operation} took ${elapsedMs}ms ` +
                  `(active queries: ${stats.activeQueries})`,
              );
            }
          }
        },
      },
    },
  }) as unknown as PrismaClient;
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

  // Keep one pool per dev process. Recreating the client on HMR without fully
  // awaiting disconnect leaves orphaned pools that exhaust connection limits.
  if (
    !global.cachedPrisma ||
    global.cachedPrismaUrl !== databaseUrl ||
    global.cachedPrismaSchemaSignature !== schemaSignature ||
    global.cachedPrismaRuntimeVersion !== prismaRuntimeVersion
  ) {
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
  const message = getPrismaErrorMessage(error);

  if (isPrismaAccessDeniedErrorMessage(message)) {
    return false;
  }

  return (
    message.includes("P2028") ||
    message.includes("Unable to start a transaction in the given time") ||
    message.includes("pool timeout: failed to retrieve a connection from pool") ||
    message.includes("read ECONNRESET") ||
    message.includes("pool is ending")
  );
}

function getPrismaErrorMessage(error: unknown): string {
  return collectPrismaErrorMessages(error).join("\n");
}

function collectPrismaErrorMessages(
  error: unknown,
  seen = new WeakSet<object>()
): string[] {
  if (!error || typeof error !== "object") {
    return [String(error)];
  }

  if (seen.has(error)) {
    return [];
  }
  seen.add(error);

  const messages: string[] = [];
  const record = error as Record<string, unknown>;
  for (const key of ["message", "originalMessage", "code", "originalCode", "state"]) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      messages.push(String(value));
    }
  }

  for (const key of ["cause", "originalError"]) {
    if (key in record) {
      messages.push(...collectPrismaErrorMessages(record[key], seen));
    }
  }

  return messages.length > 0 ? messages : [String(error)];
}

function isPrismaAccessDeniedErrorMessage(message: string) {
  return (
    message.includes("Access denied for user") ||
    message.includes("ER_ACCESS_DENIED_ERROR") ||
    message.includes("SQLState: 28000")
  );
}

export function isPrismaAccessDeniedError(error: unknown) {
  return isPrismaAccessDeniedErrorMessage(getPrismaErrorMessage(error));
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
export const prisma = new Proxy({} as PrismaClient, {
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

export const prismadb = prisma;
