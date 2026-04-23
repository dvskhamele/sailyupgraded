import { Prisma } from "@prisma/client";

function getModelFieldNames(modelName: string) {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
  return new Set(model?.fields.map((field) => field.name) ?? []);
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
