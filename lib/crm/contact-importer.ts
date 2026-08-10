/**
 * Page-Aware Dynamic Contact Import Engine
 *
 * A generic, reusable, scalable, production-ready importer that:
 * - Normalizes Excel headers (removes spaces, underscores, hyphens; ignores case)
 * - Auto-maps fields to the Contacts model or custom fields
 * - Accepts contactType from the frontend (never guesses from Excel)
 * - Supports batch inserts, large files, and per-row error isolation
 * - Returns detailed import summary
 * - Duplicate records are always allowed — no duplicate detection is performed
 * - NO required field validation — any row with at least one non-empty value is imported
 * - Only completely empty rows are skipped
 */
import { prismadb } from "@/lib/prisma";
import {
  type CustomFieldDefinition,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { normalizeContactRole, type ContactRole } from "@/lib/contact-options";
import { isEmptyRow } from "@/lib/crm/import-engine";
import {
  getAgentSpreadsheetFields,
  getAgentSpreadsheetHeaderMap,
  isAgentSpreadsheetImportable,
  normalizeSpreadsheetHeader,
} from "@/lib/crm/agent-spreadsheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContactImportRow = Record<string, string>;

export type ContactImportContactType =
  | "customer"
  | "agent"
  | "prospect"
  | "vendor"
  | "partner"
  | "other"
  | string;

export interface ContactImportFieldMapping {
  /** Excel header -> model field name */
  modelFields: Record<string, string>;
  /** Excel header -> custom field id */
  customFields: Record<string, string>;
  /** Excel headers that couldn't be mapped to anything */
  unknownHeaders: string[];
}

export interface ContactImportValidationError {
  row: number;
  email: string | null;
  field: string;
  reason: string;
}

export interface ContactImportSummary {
  totalRows: number;
  importedRows: number;
  skippedEmptyRows: number;
  failedRows: number;
  validationErrors: ContactImportValidationError[];
  mappedFields: string[];
  customFields: string[];
  unsupportedColumns: string[];
}

export interface ContactImportOptions {
  /** Contact type coming from the page context (e.g. "customer", "agent") */
  contactType: ContactImportContactType;
  /** User ID performing the import */
  userId: string;
  /** Import batch ID for serial generation */
  importBatchId?: string;
}

// ---------------------------------------------------------------------------
// Standard field aliases (normalized -> model field name)
// ---------------------------------------------------------------------------

const STANDARD_FIELD_ALIASES: Record<string, string[]> = {
  serial: [
    "serial",
    "reference id",
    "reference number",
    "referenceid",
    "referencenumber",
    "role id",
    "contact id",
    "sr no",
    "sequence",
  ],
  first_name: ["first name", "firstname", "given name"],
  last_name: ["last name", "lastname", "surname", "family name"],
  email: ["email", "e-mail", "email address", "mail", "electronic mail"],
  personal_email: ["personal email", "personalemail", "private email"],
  mobile_phone: ["mobile", "mobile phone", "mobilephone", "cell", "cell phone"],
  office_phone: [
    "office phone",
    "officephone",
    "telephone",
    "tel",
    "work phone",
    "phone",
    "phone number",
  ],
  website: ["website", "web", "url", "site"],
  position: ["position", "job title", "title", "designation"],
  description: ["description", "notes", "note", "details"],
  birthday: ["birthday", "birth date", "birthdate", "dob", "date of birth"],
  company: ["company", "company name", "assigned company", "organization", "organisation"],
  jobTitle: ["job title", "jobtitle"],
  address: ["address", "full address"],
  address_line1: ["address line 1", "addressline1", "street", "street 1"],
  address_line2: ["address line 2", "addressline2", "street 2"],
  city: ["city", "town"],
  state: ["state", "region", "province"],
  country: ["country"],
  postal_code: ["postal code", "postalcode", "zip", "zip code", "pincode"],
  status: ["status", "active", "is active", "isactive"],
  assigned_to: ["assigned to", "assignedto", "owner", "user", "assignee"],
  assigned_account: [
    "account",
    "account name",
    "accountname",
    "assigned account",
    "assignedaccount",
    "company name",
    "company",
  ],
  social_twitter: ["twitter", "x"],
  social_facebook: ["facebook"],
  social_linkedin: ["linkedin", "linkedin url", "linkedin profile", "linkedinurl"],
  social_skype: ["thread", "skype"],
  social_youtube: ["youtube"],
  social_tiktok: ["tiktok", "tik tok"],
  social_instagram: ["instagram"],
  lead_source_id: ["lead source", "leadsource", "lead source id"],
  lead_status_id: ["lead status", "leadstatus", "lead status id"],
  lead_type_id: ["lead type", "leadtype", "lead type id"],
  refered_by: ["referred by", "refered by", "referrer", "referredby"],
  campaign: ["campaign"],
};

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

function buildModelFieldLookup(): Map<string, string> {
  const lookup = getAgentSpreadsheetHeaderMap();

  // Add all aliases
  for (const [fieldName, aliases] of Object.entries(STANDARD_FIELD_ALIASES)) {
    lookup.set(normalizeHeader(fieldName), fieldName);
    for (const alias of aliases) {
      lookup.set(normalizeHeader(alias), fieldName);
    }
  }

  // Additional common mappings
  lookup.set(normalizeHeader("full name"), "first_name");
  lookup.set(normalizeHeader("contact name"), "first_name");
  lookup.set(normalizeHeader("fullname"), "first_name");
  lookup.set(normalizeHeader("assigned company"), "company");
  lookup.set(normalizeHeader("company"), "company");

  return lookup;
}

// ---------------------------------------------------------------------------
// Find a matching model field for a given header
// ---------------------------------------------------------------------------

let _modelFieldLookup: Map<string, string> | null = null;

function getModelFieldLookup(): Map<string, string> {
  if (!_modelFieldLookup) {
    _modelFieldLookup = buildModelFieldLookup();
  }
  return _modelFieldLookup;
}

/**
 * Find a matching model field for an Excel header.
 * Returns the model field name, or null if no match.
 *
 * "First Name" → "first_name"
 * "email_address" → "email"
 * "Assigned Company" → "company"
 * "SomeRandomField" → null
 */
export function findMatchingField(header: string): string | null {
  const normalized = normalizeHeader(header);
  const lookup = getModelFieldLookup();
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
  customFieldDefinitions: CustomFieldDefinition[],
): ContactImportFieldMapping {
  const modelFields: Record<string, string> = {};
  const customFields: Record<string, string> = {};
  const unknownHeaders: string[] = [];

  const headerMap = getAgentSpreadsheetHeaderMap(customFieldDefinitions);

  for (const header of headers) {
    // Try model field match first
    const matchingField = headerMap.get(normalizeSpreadsheetHeader(header));
    if (matchingField?.startsWith("custom:")) {
      customFields[header] = matchingField.slice("custom:".length);
      continue;
    }
    if (matchingField) {
      modelFields[header] = matchingField;
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

export interface MappedRow {
  modelValues: Record<string, string>;
  customFieldValues: Record<string, string>;
  unknownColumnValues: Record<string, string>;
}

/**
 * Map a single Excel row to model values, custom field values, and unknown values.
 */
export function mapRow(
  row: ContactImportRow,
  mapping: ContactImportFieldMapping,
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
  return mappedRow.customFieldValues;
}

function coerceScalarValue(fieldName: string, value: string) {
  const field = getAgentSpreadsheetFields().find((candidate) => candidate.key === fieldName);
  if (!field) return value;
  if (field.type === "Boolean") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(normalized)) return false;
    throw new Error(`Invalid boolean value "${value}" for ${field.label}`);
  }
  if (["Int", "Float", "Decimal"].includes(field.type)) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Invalid number value "${value}" for ${field.label}`);
    return number;
  }
  if (field.type === "DateTime") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time value "${value}" for ${field.label}`);
    return date;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Get the contact role from contactType
// ---------------------------------------------------------------------------

function getContactRoleFromType(contactType: ContactImportContactType): ContactRole {
  const normalized = contactType.toLowerCase().trim();
  switch (normalized) {
    case "customer":
    case "clients":
      return "Customer";
    case "agent":
    case "agents":
      return "Agent";
    case "prospect":
    case "prospects":
      return "Customer"; // prospects are stored as Customer role with type differentiation
    case "vendor":
    case "vendors":
      return "Vendor";
    case "partner":
    case "partners":
      return "Partner";
    default:
      return "Other";
  }
}

// ---------------------------------------------------------------------------
// Generate a fallback serial number
// ---------------------------------------------------------------------------

function getSerialPrefix(role: ContactRole): string {
  switch (role) {
    case "Agent":
      return "AGT";
    case "Partner":
      return "PRT";
    case "Vendor":
      return "VND";
    case "Customer":
    default:
      return "CUST";
  }
}

function generateSerial(
  role: ContactRole,
  rowIndex: number,
  batchId: string,
): string {
  return `${getSerialPrefix(role)}-${batchId}-${String(rowIndex + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Normalize phone number
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\+/g, "")}`;
  }
  return digits;
}

// ---------------------------------------------------------------------------
// Normalize email
// ---------------------------------------------------------------------------

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Bulk insert contacts with error isolation
// ---------------------------------------------------------------------------

export interface BulkInsertResult {
  imported: number;
  updated: number;
  errors: ContactImportValidationError[];
}

/**
 * Bulk insert mapped contacts into the database.
 * Each row is processed individually so that one failure doesn't stop the batch.
 * Duplicate records are always allowed — no duplicate detection is performed.
 * No required field validation — any row with data is imported.
 */
export async function bulkInsertContacts(
  mappedRows: Array<{
    row: ContactImportRow;
    mapped: MappedRow;
    rowNumber: number;
  }>,
  options: ContactImportOptions,
  customFieldDefinitions: CustomFieldDefinition[],
): Promise<BulkInsertResult> {
  const {
    contactType,
    userId,
    importBatchId = Date.now().toString(36).toUpperCase(),
  } = options;

  const role = getContactRoleFromType(contactType);
  const normalizedRole = normalizeContactRole(role);

  // Collect unique lookup values for resolution
  const uniqueUsers = new Set<string>();
  const uniqueAccounts = new Set<string>();
  const uniqueLeadSources = new Set<string>();
  const uniqueLeadStatuses = new Set<string>();
  const uniqueLeadTypes = new Set<string>();
  const uniqueContactTypes = new Set<string>();

  for (const { mapped } of mappedRows) {
    if (mapped.modelValues.assigned_to) uniqueUsers.add(mapped.modelValues.assigned_to);
    if (mapped.modelValues.accountsIDs) uniqueAccounts.add(mapped.modelValues.accountsIDs);
    if (mapped.modelValues.lead_source_id) uniqueLeadSources.add(mapped.modelValues.lead_source_id);
    if (mapped.modelValues.lead_status_id) uniqueLeadStatuses.add(mapped.modelValues.lead_status_id);
    if (mapped.modelValues.lead_type_id) uniqueLeadTypes.add(mapped.modelValues.lead_type_id);
    if (mapped.modelValues.contact_type_id) uniqueContactTypes.add(mapped.modelValues.contact_type_id);
  }

  // Resolve lookup values
  const [users, accounts, leadSources, leadStatuses, leadTypes, contactTypes] = await Promise.all([
    uniqueUsers.size
      ? prismadb.users.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueUsers) } },
              { email: { in: Array.from(uniqueUsers) } },
              { name: { in: Array.from(uniqueUsers) } },
            ],
          },
          select: { id: true, email: true, name: true },
        })
      : Promise.resolve([]),
    uniqueAccounts.size
      ? prismadb.crm_Accounts.findMany({
          where: {
            deletedAt: null,
            OR: [
              { id: { in: Array.from(uniqueAccounts) } },
              { name: { in: Array.from(uniqueAccounts) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueLeadSources.size
      ? prismadb.crm_Lead_Sources.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueLeadSources) } },
              { name: { in: Array.from(uniqueLeadSources) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueLeadStatuses.size
      ? prismadb.crm_Lead_Statuses.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueLeadStatuses) } },
              { name: { in: Array.from(uniqueLeadStatuses) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueLeadTypes.size
      ? prismadb.crm_Lead_Types.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueLeadTypes) } },
              { name: { in: Array.from(uniqueLeadTypes) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueContactTypes.size
      ? prismadb.crm_Contact_Types.findMany({
          where: { OR: [{ id: { in: Array.from(uniqueContactTypes) } }, { name: { in: Array.from(uniqueContactTypes) } }] },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  // Build lookup maps
  const userLookup = new Map<string, string>();
  const accountLookup = new Map<string, string>();
  const leadSourceLookup = new Map<string, string>();
  const leadStatusLookup = new Map<string, string>();
  const leadTypeLookup = new Map<string, string>();
  const contactTypeLookup = new Map<string, string>();

  users.forEach((u) => {
    userLookup.set(u.id, u.id);
    if (u.email) userLookup.set(u.email, u.id);
    if (u.name) userLookup.set(u.name, u.id);
  });
  accounts.forEach((a) => {
    accountLookup.set(a.id, a.id);
    accountLookup.set(a.name, a.id);
    accountLookup.set(a.name.trim().toLowerCase(), a.id);
  });
  leadSources.forEach((ls) => {
    leadSourceLookup.set(ls.id, ls.id);
    leadSourceLookup.set(ls.name, ls.id);
    leadSourceLookup.set(ls.name.trim().toLowerCase(), ls.id);
  });
  leadStatuses.forEach((ls) => {
    leadStatusLookup.set(ls.id, ls.id);
    leadStatusLookup.set(ls.name, ls.id);
    leadStatusLookup.set(ls.name.trim().toLowerCase(), ls.id);
  });
  leadTypes.forEach((lt) => {
    leadTypeLookup.set(lt.id, lt.id);
    leadTypeLookup.set(lt.name, lt.id);
    leadTypeLookup.set(lt.name.trim().toLowerCase(), lt.id);
  });
  contactTypes.forEach((type) => {
    contactTypeLookup.set(type.id, type.id);
    contactTypeLookup.set(type.name, type.id);
    contactTypeLookup.set(type.name.trim().toLowerCase(), type.id);
  });

  // Auto-create missing accounts
  const accountNamesSet = new Set(accounts.map((a) => a.name.trim().toLowerCase()));
  const missingAccountNames = Array.from(uniqueAccounts).filter(
    (name) => !accountNamesSet.has(name.trim().toLowerCase()) && !accountLookup.has(name.trim().toLowerCase()),
  );
  for (const accountName of missingAccountNames) {
    const account = await prismadb.crm_Accounts.create({
      data: {
        v: 0,
        name: accountName.trim(),
        status: "Active",
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true, name: true },
    });
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(account.name.trim().toLowerCase(), account.id);
  }

  let imported = 0;
  const errors: ContactImportValidationError[] = [];

  for (const { row: rawRow, mapped, rowNumber } of mappedRows) {
    try {
      const email = mapped.modelValues.email || "";
      const normalizedEmailVal = email ? normalizeEmail(email) : "";
      const mobilePhone = mapped.modelValues.mobile_phone || "";
      const normalizedMobilePhone = mobilePhone ? normalizePhone(mobilePhone) : "";
      const officePhone = mapped.modelValues.office_phone || "";
      const normalizedOfficePhone = officePhone ? normalizePhone(officePhone) : "";

      // Compute name - use "Imported Contact" as fallback if no name provided
      const firstName = mapped.modelValues.first_name || "";
      const lastName = mapped.modelValues.last_name || "";
      const fullName = mapped.modelValues.name || "";
      const computedFirstName = firstName || fullName;
      const computedLastName = lastName || (fullName ? "" : "Imported Contact");

      // Resolve references
      const resolvedAssignedTo = mapped.modelValues.assigned_to
        ? userLookup.get(mapped.modelValues.assigned_to) ?? userLookup.get(mapped.modelValues.assigned_to.trim().toLowerCase())
        : undefined;
      const resolvedAccount = mapped.modelValues.accountsIDs
        ? accountLookup.get(mapped.modelValues.accountsIDs) ?? accountLookup.get(mapped.modelValues.accountsIDs.trim().toLowerCase())
        : undefined;
      const resolvedLeadSource = mapped.modelValues.lead_source_id
        ? leadSourceLookup.get(mapped.modelValues.lead_source_id) ?? leadSourceLookup.get(mapped.modelValues.lead_source_id.trim().toLowerCase())
        : undefined;
      const resolvedLeadStatus = mapped.modelValues.lead_status_id
        ? leadStatusLookup.get(mapped.modelValues.lead_status_id) ?? leadStatusLookup.get(mapped.modelValues.lead_status_id.trim().toLowerCase())
        : undefined;
      const resolvedLeadType = mapped.modelValues.lead_type_id
        ? leadTypeLookup.get(mapped.modelValues.lead_type_id) ?? leadTypeLookup.get(mapped.modelValues.lead_type_id.trim().toLowerCase())
        : undefined;
      const resolvedContactType = mapped.modelValues.contact_type_id
        ? contactTypeLookup.get(mapped.modelValues.contact_type_id) ?? contactTypeLookup.get(mapped.modelValues.contact_type_id.trim().toLowerCase())
        : undefined;
      const unresolvedRelationship = [
        ["Assigned Member", mapped.modelValues.assigned_to, resolvedAssignedTo],
        ["Assigned Company", mapped.modelValues.accountsIDs, resolvedAccount],
        ["Contact Type", mapped.modelValues.contact_type_id, resolvedContactType],
        ["Lead Source", mapped.modelValues.lead_source_id, resolvedLeadSource],
        ["Lead Status", mapped.modelValues.lead_status_id, resolvedLeadStatus],
        ["Lead Type", mapped.modelValues.lead_type_id, resolvedLeadType],
      ].find(([, value, resolved]) => value && !resolved);
      if (unresolvedRelationship) {
        throw new Error(`${unresolvedRelationship[0]} value "${unresolvedRelationship[1]}" could not be resolved to an existing record.`);
      }

      // Handle custom fields
      const allCustomValues = extractCustomFields(mapped, customFieldDefinitions);
      for (const customField of customFieldDefinitions) {
        const customValue = allCustomValues[customField.id];
        if (customField.type === "file" && allCustomValues[customField.id]) {
          throw new Error(`${customField.name} cannot be imported from Excel because file fields require an uploaded file.`);
        }
        if (customValue && customField.type === "number" && !Number.isFinite(Number(customValue))) {
          throw new Error(`Invalid number value "${customValue}" for custom field ${customField.name}.`);
        }
        if (customValue && customField.type === "select") {
          const options = Array.isArray(customField.options) ? customField.options.filter((option): option is string => typeof option === "string") : [];
          if (options.length > 0 && !options.includes(customValue)) {
            throw new Error(`Invalid option "${customValue}" for custom field ${customField.name}.`);
          }
        }
      }
      const sanitizedCustomValues = sanitizeCustomFieldValues(allCustomValues, customFieldDefinitions);
      const customFieldsData = Object.keys(sanitizedCustomValues).length > 0
        ? sanitizedCustomValues
        : undefined;

      // Serial
      const serial = mapped.modelValues.serial || generateSerial(normalizedRole, rowNumber, importBatchId);
      const supportedSerial = await pickExistingDbModelFields("crm_Contacts", { serial });
      const dynamicFields = getAgentSpreadsheetFields();
      const supportedDynamicValues: Record<string, unknown> = {};
      for (const [fieldName, value] of Object.entries(mapped.modelValues)) {
        const field = dynamicFields.find((candidate) => candidate.key === fieldName);
        if (!field || !isAgentSpreadsheetImportable(field)) {
          if (field && value) throw new Error(`${field.label} cannot be imported from Excel (${field.type} fields require a supported upload flow).`);
          continue;
        }
        if (["serial", "first_name", "last_name", "email", "personal_email", "mobile_phone", "office_phone", "accountsIDs", "assigned_to", "contact_type_id", "lead_source_id", "lead_status_id", "lead_type_id", "role", "status"].includes(fieldName)) continue;
        supportedDynamicValues[fieldName] = coerceScalarValue(fieldName, value);
      }

      // Build contact payload
      const contactPayload = {
        ...supportedSerial,
        ...supportedDynamicValues,
        v: 1,
        first_name: computedFirstName || undefined,
        last_name: computedLastName,
        email: normalizedEmailVal || undefined,
        personal_email: mapped.modelValues.personal_email || undefined,
        mobile_phone: normalizedMobilePhone || undefined,
        office_phone: normalizedOfficePhone || undefined,
        status: mapped.modelValues.status ? mapped.modelValues.status.toLowerCase() === "active" || mapped.modelValues.status === "1" || mapped.modelValues.status.toLowerCase() === "true" : true,
        assigned_to: resolvedAssignedTo,
        accountsIDs: resolvedAccount,
        contact_type_id: resolvedContactType,
        lead_source_id: resolvedLeadSource,
        lead_status_id: resolvedLeadStatus,
        lead_type_id: resolvedLeadType,
        refered_by: mapped.modelValues.refered_by || undefined,
        campaign: mapped.modelValues.campaign || undefined,
        social_twitter: mapped.modelValues.social_twitter || undefined,
        social_facebook: mapped.modelValues.social_facebook || undefined,
        social_linkedin: mapped.modelValues.social_linkedin || undefined,
        social_skype: mapped.modelValues.social_skype || undefined,
        social_instagram: mapped.modelValues.social_instagram || undefined,
        social_youtube: mapped.modelValues.social_youtube || undefined,
        social_tiktok: mapped.modelValues.social_tiktok || undefined,
        custom_fields_data: customFieldsData,
        role: normalizedRole,
        createdBy: userId,
        updatedBy: userId,
        tags: [],
        notes: [],
      };

      await prismadb.crm_Contacts.create({
        data: contactPayload as any,
        select: { id: true },
      });
      imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        email: mapped.modelValues.email || null,
        field: "general",
        reason: error instanceof Error ? error.message : "Unknown error processing row",
      });
    }
  }

  return { imported, updated: 0, errors };
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Main entry point for importing contacts.
 * Returns a detailed summary of the import operation.
 * No required field validation — any row with at least one non-empty value is imported.
 * Only completely empty rows are skipped.
 */
export async function importContacts(
  rows: ContactImportRow[],
  options: ContactImportOptions,
  customFieldDefinitions: CustomFieldDefinition[],
): Promise<ContactImportSummary> {
  const allHeaders = Array.from(
    rows.reduce((headers, row) => {
      Object.keys(row).forEach((header) => {
        if (header.trim()) headers.add(header);
      });
      return headers;
    }, new Set<string>()),
  );

  // Build field mapping
  const mapping = buildFieldMapping(allHeaders, customFieldDefinitions);

  // Map rows and skip only completely empty rows
  const rowsToImport: Array<{ row: ContactImportRow; mapped: MappedRow; rowNumber: number }> = [];
  let skippedEmptyRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // 1-indexed with header row

    // Skip only completely empty rows
    if (isEmptyRow(rows[i])) {
      skippedEmptyRows += 1;
      continue;
    }

    const mapped = mapRow(rows[i], mapping);
    rowsToImport.push({ row: rows[i], mapped, rowNumber });
  }

  // Bulk insert all non-empty rows
  const { imported, errors } = await bulkInsertContacts(rowsToImport, options, customFieldDefinitions);

  // Compile summary
  const mappedFields = Object.values(mapping.modelFields);
  const customFields = Object.values(mapping.customFields);

  return {
    totalRows: rows.length,
    importedRows: imported,
    skippedEmptyRows,
    failedRows: errors.length,
    validationErrors: errors,
    mappedFields: [...new Set(mappedFields)],
    customFields: [...new Set(customFields)],
    unsupportedColumns: mapping.unknownHeaders,
  };
}
