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

export type CustomFieldFileValue = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export type CustomFieldValue = string | number | boolean | CustomFieldFileValue;
export type CustomFieldValues = Record<string, CustomFieldValue>;

/**
 * Canonical header and field-name normalizer:
 * Converts to lowercase and removes all non-alphanumeric characters.
 * "Customer Type", "customer_type", "Customer-Type", "CUSTOMER TYPE " -> "customertype"
 */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // Fall back to splitting by comma
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
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

  if (!contactRole || contactRole === "all") {
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

/**
 * Safely sanitizes custom field input values from forms or Excel imports.
 * Maps values to the canonical custom field UUIDs and validates data types.
 */
export function sanitizeCustomFieldValues(
  values: unknown,
  fields: CustomFieldDefinition[],
): CustomFieldValues {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  const rawValues = values as Record<string, unknown>;
  const sanitizedEntries: [string, CustomFieldValue][] = [];
  const consumedKeys = new Set<string>();

  fields.forEach((field) => {
    const normalizedField = normalizeCustomField(field);
    const fieldId = normalizedField.id;
    const normalizedName = normalizeHeader(normalizedField.name);

    let rawValue: unknown = undefined;

    // 1. Direct field ID match (e.g. rawValues["uuid-123"])
    if (rawValues[fieldId] !== undefined) {
      rawValue = rawValues[fieldId];
      consumedKeys.add(fieldId);
    } else if (rawValues[`custom:${fieldId}`] !== undefined) {
      // 2. Prefixed field ID match (e.g. rawValues["custom:uuid-123"])
      rawValue = rawValues[`custom:${fieldId}`];
      consumedKeys.add(`custom:${fieldId}`);
    } else {
      // 3. Normalized header/key match
      for (const [key, val] of Object.entries(rawValues)) {
        if (consumedKeys.has(key) || val === undefined || val === null) continue;

        const normalizedKey = normalizeHeader(key);
        const strippedKey = normalizeHeader(key.replace(/^custom_?(field_?)?/i, ""));

        if (
          normalizedKey === normalizedName ||
          strippedKey === normalizedName ||
          normalizedKey === normalizeHeader(fieldId) ||
          normalizedKey === normalizeHeader(`custom:${fieldId}`)
        ) {
          rawValue = val;
          consumedKeys.add(key);
          break;
        }
      }
    }

    if (rawValue === undefined || rawValue === null) {
      return;
    }

    // Handle File fields
    if (normalizedField.type === "file") {
      if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
        return;
      }

      const metadata = rawValue as Record<string, unknown>;
      if (
        typeof metadata.url !== "string" ||
        typeof metadata.name !== "string" ||
        typeof metadata.size !== "number" ||
        !Number.isFinite(metadata.size) ||
        typeof metadata.type !== "string"
      ) {
        return;
      }

      sanitizedEntries.push([
        fieldId,
        {
          url: metadata.url,
          name: metadata.name,
          size: metadata.size,
          type: metadata.type,
        },
      ]);
      return;
    }

    const trimmedString = String(rawValue).trim();
    if (!trimmedString) {
      return;
    }

    // Handle Select fields
    if (normalizedField.type === "select") {
      if (normalizedField.options.length > 0) {
        const matchedOption = normalizedField.options.find(
          (opt) => opt.trim().toLowerCase() === trimmedString.toLowerCase(),
        );
        if (matchedOption) {
          sanitizedEntries.push([fieldId, matchedOption]);
        }
      } else {
        sanitizedEntries.push([fieldId, trimmedString]);
      }
      return;
    }

    // Handle Number fields
    if (normalizedField.type === "number") {
      const cleaned = trimmedString.replace(/,/g, "").replace(/[$€£¥]/g, "").trim();
      const num = Number(cleaned);
      if (Number.isFinite(num)) {
        sanitizedEntries.push([fieldId, String(num)]);
      }
      return;
    }

    // Handle Boolean fields
    if (normalizedField.type === "boolean" || normalizedField.type === "checkbox") {
      const lower = trimmedString.toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(lower)) {
        sanitizedEntries.push([fieldId, "true"]);
      } else if (["false", "0", "no", "n", "inactive"].includes(lower)) {
        sanitizedEntries.push([fieldId, "false"]);
      }
      return;
    }

    // Default string / text / date fields
    sanitizedEntries.push([fieldId, trimmedString]);
  });

  return Object.fromEntries(sanitizedEntries) as CustomFieldValues;
}

/**
 * Safely merges existing custom field values with newly imported custom field values.
 * Preserves existing values when the imported row does not provide a value for a field.
 */
export function mergeCustomFieldValues(
  existingValues: unknown,
  newValues: unknown,
): Record<string, unknown> {
  const existingMap =
    existingValues && typeof existingValues === "object" && !Array.isArray(existingValues)
      ? (existingValues as Record<string, unknown>)
      : {};
  const newMap =
    newValues && typeof newValues === "object" && !Array.isArray(newValues)
      ? (newValues as Record<string, unknown>)
      : {};

  const merged = { ...existingMap };
  for (const [key, val] of Object.entries(newMap)) {
    if (val !== undefined && val !== null && val !== "") {
      merged[key] = val;
    }
  }

  return merged;
}
