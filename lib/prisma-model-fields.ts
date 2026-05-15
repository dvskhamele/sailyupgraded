import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";

declare global {
  var cachedPrismaDbColumnNames: Map<string, Promise<Set<string>>> | undefined;
}

function getModelFieldNames(modelName: string) {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
  return new Set(model?.fields.map((field) => field.name) ?? []);
}

function getModelMetadata(modelName: string) {
  return Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
}

function getDbColumnCache() {
  if (!global.cachedPrismaDbColumnNames) {
    global.cachedPrismaDbColumnNames = new Map<string, Promise<Set<string>>>();
  }

  return global.cachedPrismaDbColumnNames;
}

export async function getExistingDbColumnNames(modelName: string) {
  const dbColumnCache = getDbColumnCache();
  const cached = dbColumnCache.get(modelName);
  if (cached) return cached;

  const promise = (async () => {
    const model = getModelMetadata(modelName);
    if (!model) return new Set<string>();

    const tableName = model.dbName ?? model.name;
    const rows = await prismadb.$queryRaw<Array<{ COLUMN_NAME: string }>>`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ${tableName}
      ORDER BY ORDINAL_POSITION
    `;

    return new Set(rows.map((row) => row.COLUMN_NAME));
  })();

  dbColumnCache.set(modelName, promise);

  try {
    return await promise;
  } catch (error) {
    dbColumnCache.delete(modelName);
    throw error;
  }
}

export function pickSupportedModelFields<T extends Record<string, unknown>>(
  modelName: string,
  values: T
) {
  const supportedFields = getModelFieldNames(modelName);

  return Object.fromEntries(
    Object.entries(values).filter(([key]) => supportedFields.has(key))
  ) as Partial<T>;
}

export async function pickExistingDbModelFields<T extends Record<string, unknown>>(
  modelName: string,
  values: T
) {
  const model = getModelMetadata(modelName);
  if (!model) return {} as Partial<T>;

  const supportedFields = getModelFieldNames(modelName);
  const dbColumns = await getExistingDbColumnNames(modelName);
  const dbFieldNames = new Set(
    model.fields
      .filter((field) => field.kind === "scalar" || field.kind === "enum")
      .filter((field) => dbColumns.has(field.dbName ?? field.name))
      .map((field) => field.name)
  );

  return Object.fromEntries(
    Object.entries(values).filter(([key]) => supportedFields.has(key) && dbFieldNames.has(key))
  ) as Partial<T>;
}
