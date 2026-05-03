export type CustomFieldEntity = "Contact" | "Lead" | "Opportunity";

export type CustomFieldDefinition = {
  id: string;
  name: string;
  type: string;
  applies_to: unknown;
  options?: unknown;
};

export type NormalizedCustomFieldDefinition = {
  id: string;
  name: string;
  type: string;
  applies_to: string[];
  options: string[];
};

export type CustomFieldValues = Record<string, string>;

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCustomField(field: CustomFieldDefinition) {
  return {
    ...field,
    applies_to: normalizeStringArray(field.applies_to),
    options: normalizeStringArray(field.options),
  } satisfies NormalizedCustomFieldDefinition;
}

export function fieldAppliesToEntity(
  field: CustomFieldDefinition,
  entityType: CustomFieldEntity,
) {
  return normalizeCustomField(field).applies_to.includes(entityType);
}

export function filterCustomFieldsForEntity(
  fields: CustomFieldDefinition[],
  entityType: CustomFieldEntity,
) {
  return fields
    .map(normalizeCustomField)
    .filter((field) => field.applies_to.includes(entityType));
}

export function sanitizeCustomFieldValues(
  values: unknown,
  fields: CustomFieldDefinition[],
) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  const rawValues = values as Record<string, unknown>;
  const sanitizedEntries = fields.flatMap((field) => {
    const normalizedField = normalizeCustomField(field);
    const rawValue = rawValues[normalizedField.id];

    if (rawValue == null) {
      return [];
    }

    const value = String(rawValue).trim();
    if (!value) {
      return [];
    }

    if (
      normalizedField.type === "select" &&
      normalizedField.options.length > 0 &&
      !normalizedField.options.includes(value)
    ) {
      return [];
    }

    if (normalizedField.type === "number" && Number.isNaN(Number(value))) {
      return [];
    }

    return [[normalizedField.id, value] as const];
  });

  return Object.fromEntries(sanitizedEntries) as CustomFieldValues;
}
