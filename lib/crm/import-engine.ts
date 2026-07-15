/**
 * Shared Import Engine
 *
 * A generic, reusable import engine that both Contacts and Opportunities
 * importers use. Contains all common utilities for:
 * - Normalizing headers
 * - Building model field lookups from Prisma DMMF
 * - Building field mappings (model fields + custom fields)
 * - Mapping rows
 * - Extracting custom fields
 *
 * This avoids duplicating code between contact-importer and opportunity-importer.
 */
import { Prisma } from "@prisma/client";
import {
  type CustomFieldDefinition,
  normalizeCustomField,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportRow = Record<string, string>;

export interface ImportFieldMapping {
  /** Excel header -> model field name */
  modelFields: Record<string, string>;
  /** Excel header -> custom field id */
  customFields: Record<string, string>;
  /** Excel headers that couldn't be mapped to anything */
  unknownHeaders: string[];
}

export interface ImportValidationError {
  row: number;
  field: string;
  reason: string;
  identifier: string | null;
}

export interface ImportSummary {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  validationErrors: ImportValidationError[];
  mappedFields: string[];
  customFields: string[];
  failedRows: number;
}

export interface MappedRow {
  modelValues: Record<string, string>;
  customFieldValues: Record<string, string>;
  unknownColumnValues: Record<string, string>;
}

export interface RowValidationResult {
  valid: boolean;
  errors: ImportValidationError[];
}

// ---------------------------------------------------------------------------
// Helper: Normalize a header value
// ---------------------------------------------------------------------------

/**
 * Normalize a header by:
 * - Trimming whitespace
 * - Converting to lowercase
 * - Removing all spaces, underscores, hyphens
 *
 * "First Name", "first_name", "first-name", "firstname" → "firstname"
 * "Email Address", "email_address", "email-address" → "emailaddress"
 * "Opportunity Name", "opportunity_name", "opportunity-name" → "opportunityname"
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
}

// ---------------------------------------------------------------------------
// Helper: Build a lookup of normalized model field names
// ---------------------------------------------------------------------------

/**
 * Build a lookup of normalized model field names for a given Prisma model.
 * Returns a Map where keys are normalized header strings and values are model field names.
 */
export function buildModelFieldLookup(
  modelName: string,
  standardFieldAliases: Record<string, string[]>,
  excludedFields?: Set<string>,
): Map<string, string> {
  const lookup = new Map<string, string>();

  const model = Prisma.dmmf.datamodel.models.find(
    (m) => m.name === modelName,
  );
  if (!model) {
    return lookup;
  }

  const defaultExcluded = new Set<string>([
    "id",
    "v",
    "__v",
    "createdAt",
    "createdBy",
    "created_by",
    "created_on",
    "updatedAt",
    "updatedBy",
    "deletedAt",
    "deletedBy",
    "last_activity",
    "last_activity_by",
    "tags",
    "notes",
    "custom_fields_data",
    "visible_to_name",
  ]);

  const excluded = excludedFields ?? defaultExcluded;

  for (const field of model.fields) {
    if (field.kind !== "scalar" && field.kind !== "enum") continue;
    const fieldName = field.name;
    const dbName = field.dbName ?? field.name;
    if (excluded.has(fieldName) || excluded.has(dbName)) continue;

    // Store normalized version -> actual field name
    lookup.set(normalizeHeader(fieldName), fieldName);
    if (dbName !== fieldName) {
      lookup.set(normalizeHeader(dbName), fieldName);
    }
  }

  // Add all standard aliases
  for (const [fieldName, aliases] of Object.entries(standardFieldAliases)) {
    lookup.set(normalizeHeader(fieldName), fieldName);
    for (const alias of aliases) {
      lookup.set(normalizeHeader(alias), fieldName);
    }
  }

  return lookup;
}

// ---------------------------------------------------------------------------
// Find a matching model field for a given header
// ---------------------------------------------------------------------------

/**
 * Find a matching model field for an Excel header.
 * Returns the model field name, or null if no match.
 */
export function findMatchingField(
  header: string,
  lookup: Map<string, string>,
): string | null {
  const normalized = normalizeHeader(header);
  return lookup.get(normalized) ?? null;
}

// ---------------------------------------------------------------------------
// Build full field mapping from Excel headers
// ---------------------------------------------------------------------------

/**
 * Build a mapping of all Excel headers to either model fields or custom fields.
 * Unknown headers are returned separately.
 */
export function buildFieldMapping(
  headers: string[],
  modelFieldLookup: Map<string, string>,
  customFieldDefinitions: CustomFieldDefinition[],
): ImportFieldMapping {
  const modelFields: Record<string, string> = {};
  const customFields: Record<string, string> = {};
  const unknownHeaders: string[] = [];

  // Build custom field lookup by normalized name
  const customFieldLookup = new Map<string, string>();
  for (const cf of customFieldDefinitions) {
    const normalized = normalizeCustomField(cf);
    customFieldLookup.set(normalizeHeader(normalized.name), cf.id);
  }

  for (const header of headers) {
    // Try model field match first
    const modelField = findMatchingField(header, modelFieldLookup);
    if (modelField) {
      modelFields[header] = modelField;
      continue;
    }

    // Try custom field match
    const normalizedHeader = normalizeHeader(header);
    const customFieldId = customFieldLookup.get(normalizedHeader);
    if (customFieldId) {
      customFields[header] = customFieldId;
      continue;
    }

    // Unknown header
    unknownHeaders.push(header);
  }

  return { modelFields, customFields, unknownHeaders };
}

// ---------------------------------------------------------------------------
// Map a single row using the field mapping
// ---------------------------------------------------------------------------

/**
 * Map a single Excel row to model values, custom field values, and unknown values.
 */
export function mapRow(
  row: ImportRow,
  mapping: ImportFieldMapping,
): MappedRow {
  const modelValues: Record<string, string> = {};
  const customFieldValues: Record<string, string> = {};
  const unknownColumnValues: Record<string, string> = {};

  for (const [header, value] of Object.entries(row)) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) continue;

    if (mapping.modelFields[header]) {
      modelValues[mapping.modelFields[header]] = trimmed;
    } else if (mapping.customFields[header]) {
      customFieldValues[mapping.customFields[header]] = trimmed;
    } else {
      unknownColumnValues[header] = trimmed;
    }
  }

  return { modelValues, customFieldValues, unknownColumnValues };
}

// ---------------------------------------------------------------------------
// Extract custom fields from unknown column values
// ---------------------------------------------------------------------------

/**
 * Extract custom field values from a row's unknown columns.
 * Returns values to be stored in custom_fields_data JSON.
 */
export function extractCustomFields(
  mappedRow: MappedRow,
  customFieldDefinitions: CustomFieldDefinition[],
): Record<string, string> {
  return { ...mappedRow.customFieldValues, ...mappedRow.unknownColumnValues };
}

// ---------------------------------------------------------------------------
// Determine if a row is completely empty
// ---------------------------------------------------------------------------

/**
 * Check if a row has no meaningful data (all values are empty or whitespace).
 */
export function isEmptyRow(row: ImportRow): boolean {
  return Object.values(row).every(
    (value) => String(value ?? "").trim().length === 0,
  );
}

// ---------------------------------------------------------------------------
// Re-export sanitizeCustomFieldValues from custom-fields
// ---------------------------------------------------------------------------

export { sanitizeCustomFieldValues } from "@/lib/custom-fields";