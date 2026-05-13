export type CustomFieldEntity = "Contact" | "Lead" | "Opportunity";
export type CustomFieldContactRole = "Agent" | "Customer" | "Partner" | "Vendor" | "Other";

export type CustomFieldDefinition = {
  id: string;
  name: string;
  type: string;
  applies_to: unknown;
  options?: unknown;
  contact_role?: unknown;
};

export type NormalizedCustomFieldDefinition = {
  id: string;
  name: string;
  type: string;
  applies_to: string[];
  options: string[];
  contact_role?: CustomFieldContactRole;
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

function normalizeContactRoleScope(value: unknown): CustomFieldContactRole | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "agent":
    case "agents":
      return "Agent";
    case "customer":
    case "customers":
      return "Customer";
    case "partner":
    case "partners":
      return "Partner";
    case "vendor":
    case "vendors":
      return "Vendor";
    case "other":
    case "others":
      return "Other";
    default:
      return undefined;
  }
}

export function normalizeCustomField(field: CustomFieldDefinition) {
  const rawAppliesTo = normalizeStringArray(field.applies_to);
  const contactRoleScope =
    normalizeContactRoleScope(field.contact_role) ??
    normalizeContactRoleScope(
      rawAppliesTo
        .find((item) => item.toLowerCase().startsWith("contact:"))
        ?.split(":")[1],
    );
  const appliesTo = Array.from(
    new Set(
      rawAppliesTo
        .map((item) => item.split(":")[0]?.trim())
        .filter(Boolean),
    ),
  );

  return {
    ...field,
    applies_to: appliesTo,
    options: normalizeStringArray(field.options),
    contact_role: contactRoleScope,
  } satisfies NormalizedCustomFieldDefinition;
}

function fieldAppliesToEntityScope(
  field: NormalizedCustomFieldDefinition,
  entityType: CustomFieldEntity,
) {
  return field.applies_to.some((item) => item === entityType || item.startsWith(`${entityType}:`));
}

export function fieldAppliesToContactRole(
  field: CustomFieldDefinition | NormalizedCustomFieldDefinition,
  contactRole?: string | null,
) {
  const normalizedField = normalizeCustomField(field);

  if (!normalizedField.contact_role) {
    return true;
  }

  return normalizedField.contact_role === normalizeContactRoleScope(contactRole);
}

export function fieldAppliesToEntity(
  field: CustomFieldDefinition,
  entityType: CustomFieldEntity,
  contactRole?: string | null,
) {
  const normalizedField = normalizeCustomField(field);

  if (!fieldAppliesToEntityScope(normalizedField, entityType)) {
    return false;
  }

  if (entityType !== "Contact") {
    return true;
  }

  return fieldAppliesToContactRole(normalizedField, contactRole);
}

export function filterCustomFieldsForEntity(
  fields: CustomFieldDefinition[],
  entityType: CustomFieldEntity,
  contactRole?: string | null,
) {
  return fields
    .map(normalizeCustomField)
    .filter((field) => fieldAppliesToEntity(field, entityType, contactRole));
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
