import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import {
  type ContactRole,
  detectContactRole,
  inferContactRoleFromIdentifierContext,
  normalizeContactRole,
} from "@/lib/contact-options";
import {
  fieldAppliesToEntity,
  normalizeCustomField,
  sanitizeCustomFieldValues,
  type CustomFieldDefinition,
} from "@/lib/custom-fields";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { prismadb } from "@/lib/prisma";

type RawRow = Record<string, string>;
type MappingKey =
  | "serial"
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "personal_email"
  | "mobile_phone"
  | "office_phone"
  | "website"
  | "position"
  | "description"
  | "birthday"
  | "address"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "country"
  | "postal_code"
  | "status"
  | "role"
  | "contact_type_id"
  | "assigned_to"
  | "assigned_account"
  | "social_twitter"
  | "social_facebook"
  | "social_linkedin"
  | "social_skype"
  | "social_youtube"
  | "social_tiktok";
type ColumnMapping = Partial<Record<MappingKey, string>>;
type ExistingContactMatch = {
  id: string;
  serial: string | null;
  custom_fields_data?: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKIP_VALUE = "__skip__";
const STANDARD_FIELD_ALIASES: Record<string, string[]> = {
  serial: ["reference id", "reference number", "role id", "contact id"],
  first_name: ["first name", "given name"],
  last_name: ["last name", "surname", "family name"],
  email: ["e-mail", "email address", "mail"],
  personal_email: ["personal email", "private email"],
  mobile_phone: ["mobile", "mobile phone", "cell", "cell phone"],
  office_phone: ["office phone", "telephone", "tel", "work phone"],
  position: ["title", "job title", "designation"],
  birthday: ["birth date", "birthdate", "dob"],
  address_line1: ["address line 1", "street", "street 1"],
  address_line2: ["address line 2", "street 2"],
  postal_code: ["postal code", "zip", "zip code", "pincode"],
  assigned_to: ["assigned to", "owner", "user", "assignee"],
  accountsIDs: ["account id", "assigned account id", "company id"],
  assigned_account: ["account", "account name", "assigned account", "company", "company name"],
  contact_type_id: ["contact type", "contact type id", "type"],
  social_twitter: ["twitter", "x"],
  social_facebook: ["facebook"],
  social_linkedin: ["linkedin", "linkedin url", "linkedin profile"],
  social_skype: ["thread", "skype"],
  social_youtube: ["youtube"],
  social_tiktok: ["tiktok", "tik tok"],
  social_instagram: ["instagram"],
  lead_source_id: ["lead source", "lead source id"],
  lead_status_id: ["lead status", "lead status id"],
  lead_type_id: ["lead type", "lead type id"],
  refered_by: ["referred by", "refered by", "referrer"],
};
const EXCLUDED_STANDARD_IMPORT_FIELDS = new Set([
  "id",
  "v",
  "__v",
  "createdAt",
  "createdBy",
  "created_by",
  "created_on",
  "cratedAt",
  "updatedAt",
  "updatedBy",
  "deletedAt",
  "deletedBy",
  "last_activity",
  "last_activity_by",
  "tags",
  "notes",
  "custom_fields_data",
]);

function splitFullName(name: string, fallbackEmail: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      first_name: "",
      last_name: fallbackEmail.split("@")[0] || "Imported Contact",
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      first_name: "",
      last_name: parts[0],
    };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/[^\d+]/g, "");
  return normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized;
}

function mappedValue(row: RawRow, column?: string) {
  return column ? String(row[column] ?? "").trim() : "";
}

function parseStatus(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "y", "active", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "inactive", "disabled"].includes(normalized)) return false;
  return undefined;
}

function parseSerial(value: string): string | undefined {
  return value.trim() || undefined;
}

function getFallbackSerialPrefix(role: ContactRole) {
  switch (role) {
    case "Agent":
      return "AGT";
    case "Partner":
      return "PRT";
    case "Vendor":
      return "VND";
    case "Other":
      return "OTH";
    case "Customer":
    default:
      return "CUST";
  }
}

function generateFallbackSerial(role: ContactRole, row: number, importBatchId: string) {
  return `${getFallbackSerialPrefix(role)}-${importBatchId}-${String(row).padStart(4, "0")}`;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

const ROLE_REFERENCE_ID_HEADERS = {
  agent: ["agentNumber", "agentId", "agent number", "agent id", "agent no", "agent code"],
  customer: ["customerNumber", "customerId", "customer number", "customer id", "customer no", "customer code"],
  client: ["clientNumber", "clientId", "client number", "client id", "client no", "client code"],
  other: ["otherNumber", "otherId", "other number", "other id", "other no", "other code"],
} as const;

const GENERIC_REFERENCE_ID_HEADERS = [
  "referenceId",
  "referenceNumber",
  "reference id",
  "reference number",
  "role id",
  "serial",
  "contact id",
  "contactid",
  "contact_id",
];

function normalizeHeaderToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeComparableHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getAllHeaders(rows: RawRow[]) {
  return Array.from(
    rows.reduce((headers, row) => {
      Object.keys(row).forEach((header) => {
        if (header.trim()) headers.add(header);
      });
      return headers;
    }, new Set<string>()),
  );
}

function getMappedColumns(mapping: ColumnMapping) {
  return new Set(
    Object.values(mapping)
      .filter((column): column is string => Boolean(column) && column !== SKIP_VALUE),
  );
}

function hasAnyValue(rows: RawRow[], header: string) {
  return rows.some((row) => String(row[header] ?? "").trim().length > 0);
}

function normalizeImportedColumnName(header: string) {
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  const columnName = normalized || "imported_field";
  return /^[a-z]/.test(columnName) ? columnName : `imported_${columnName}`;
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid import column name: ${identifier}`);
  }

  return `\`${identifier}\``;
}

function getImportedColumnValue(row: RawRow, column: string) {
  const value = row[column];
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

async function getContactTableColumns() {
  const rows = await prismadb.$queryRaw<Array<{ COLUMN_NAME: string }>>`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'crm_Contacts'
  `;

  return new Set(rows.map((row) => row.COLUMN_NAME));
}

function getContactModelColumnNames() {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === "crm_Contacts");
  return new Set(
    model?.fields
      .filter((field) => field.kind === "scalar" || field.kind === "enum")
      .map((field) => field.dbName ?? field.name) ?? [],
  );
}

function getContactImportableFieldLookup() {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === "crm_Contacts");
  const lookup = new Map<string, string>();

  for (const field of model?.fields ?? []) {
    if ((field.kind !== "scalar" && field.kind !== "enum") || EXCLUDED_STANDARD_IMPORT_FIELDS.has(field.name)) {
      continue;
    }

    const dbName = field.dbName ?? field.name;
    if (EXCLUDED_STANDARD_IMPORT_FIELDS.has(dbName)) {
      continue;
    }

    lookup.set(normalizeComparableHeader(field.name), field.name);
    lookup.set(normalizeComparableHeader(dbName), field.name);
  }

  for (const [field, aliases] of Object.entries(STANDARD_FIELD_ALIASES)) {
    lookup.set(normalizeComparableHeader(field), field);
    aliases.forEach((alias) => lookup.set(normalizeComparableHeader(alias), field));
  }

  lookup.set(normalizeComparableHeader("full name"), "name");
  lookup.set(normalizeComparableHeader("contact name"), "name");

  return lookup;
}

function getCustomFieldHeaderLookup(fields: CustomFieldDefinition[]) {
  const lookup = new Map<string, CustomFieldDefinition>();

  fields.forEach((field) => {
    const normalizedField = normalizeCustomField(field);
    lookup.set(normalizeComparableHeader(normalizedField.name), field);
  });

  return lookup;
}

function classifyExtraHeaders(headers: string[], customFields: CustomFieldDefinition[]) {
  const standardLookup = getContactImportableFieldLookup();
  const customLookup = getCustomFieldHeaderLookup(customFields);
  const standardHeaders = new Map<string, string>();
  const customFieldHeaders = new Map<string, CustomFieldDefinition>();
  const importedHeaders: string[] = [];

  headers.forEach((header) => {
    const normalized = normalizeComparableHeader(header);
    const standardField = standardLookup.get(normalized);
    if (standardField) {
      standardHeaders.set(header, standardField);
      return;
    }

    const customField = customLookup.get(normalized);
    if (customField) {
      customFieldHeaders.set(header, customField);
      return;
    }

    importedHeaders.push(header);
  });

  return {
    standardHeaders,
    customFieldHeaders,
    importedHeaders,
  };
}

function getDetectedStandardFieldValues(
  row: RawRow,
  standardHeaders: Map<string, string>,
  mappedFields: Set<string>,
) {
  const values: Record<string, string> = {};

  standardHeaders.forEach((field, header) => {
    if (mappedFields.has(field)) {
      return;
    }

    const value = getImportedColumnValue(row, header);
    if (value) {
      values[field] = value;
    }
  });

  return values;
}

function getDetectedCustomFieldValues(
  row: RawRow,
  customFieldHeaders: Map<string, CustomFieldDefinition>,
) {
  const values: Record<string, string> = {};

  customFieldHeaders.forEach((field, header) => {
    const value = getImportedColumnValue(row, header);
    if (value) {
      values[field.id] = value;
    }
  });

  return values;
}

function getRoleCustomFieldValues(
  row: RawRow,
  customFields: CustomFieldDefinition[],
) {
  const customLookup = getCustomFieldHeaderLookup(customFields);
  const values: Record<string, string> = {};

  Object.entries(row).forEach(([header, rawValue]) => {
    const customField = customLookup.get(normalizeComparableHeader(header));
    const value = String(rawValue ?? "").trim();
    if (customField && value) {
      values[customField.id] = value;
    }
  });

  return values;
}

function mergeCustomFieldValues(existingValues: unknown, importedValues: Record<string, string>) {
  const existing =
    existingValues && typeof existingValues === "object" && !Array.isArray(existingValues)
      ? (existingValues as Record<string, unknown>)
      : {};

  return {
    ...existing,
    ...importedValues,
  };
}

async function ensureImportedContactColumns(headers: string[]) {
  if (headers.length === 0) {
    return new Map<string, string>();
  }

  const existingColumns = await getContactTableColumns();
  const modelColumns = getContactModelColumnNames();
  const usedColumns = new Set(existingColumns);
  const headerToColumn = new Map<string, string>();

  for (const header of headers) {
    const baseColumn = normalizeImportedColumnName(header);
    let column = baseColumn;
    let suffix = 2;

    while (
      headerToColumnHasValue(headerToColumn, column) ||
      (usedColumns.has(column) && modelColumns.has(column))
    ) {
      const suffixText = `_${suffix}`;
      column = `${baseColumn.slice(0, 64 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    if (!usedColumns.has(column)) {
      await prismadb.$executeRawUnsafe(
        `ALTER TABLE ${quoteIdentifier("crm_Contacts")} ADD COLUMN ${quoteIdentifier(column)} TEXT NULL`,
      );
      usedColumns.add(column);
    }

    headerToColumn.set(header, column);
  }

  return headerToColumn;
}

function headerToColumnHasValue(headerToColumn: Map<string, string>, column: string) {
  return Array.from(headerToColumn.values()).includes(column);
}

async function updateImportedContactColumns(
  contactId: string,
  values: Record<string, string>,
) {
  const entries = Object.entries(values).filter(([, value]) => value.trim().length > 0);
  if (entries.length === 0) return;

  const assignments = entries
    .map(([column]) => `${quoteIdentifier(column)} = ?`)
    .join(", ");
  await prismadb.$executeRawUnsafe(
    `UPDATE ${quoteIdentifier("crm_Contacts")} SET ${assignments} WHERE ${quoteIdentifier("id")} = ?`,
    ...entries.map(([, value]) => value),
    contactId,
  );
}

function getReferenceHeaderGroup(role: ContactRole) {
  switch (role) {
    case "Agent":
      return "agent";
    case "Customer":
      return "customer";
    default:
      return "other";
  }
}

function findReferenceIdFromRow(row: RawRow, role: ContactRole) {
  const roleSpecificHeaders = ROLE_REFERENCE_ID_HEADERS[getReferenceHeaderGroup(role)];
  const orderedCandidates = [...roleSpecificHeaders, ...GENERIC_REFERENCE_ID_HEADERS].map(
    normalizeHeaderToken,
  );

  for (const candidate of orderedCandidates) {
    for (const [header, value] of Object.entries(row)) {
      const normalizedHeader = normalizeHeaderToken(header);
      const isMatch = normalizedHeader === candidate || normalizedHeader.includes(candidate);
      const normalizedValue = value.trim();
      if (isMatch && normalizedValue) {
        return normalizedValue;
      }
    }
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? (body.rows as RawRow[]) : [];
  const mapping = (body?.mapping || {}) as ColumnMapping;
  const duplicateMode =
    body?.duplicateMode === "update" ? "update" : "skip";
  const importRole = detectContactRole(
    typeof body?.importRole === "string" ? body.importRole : undefined,
  );

  if (!mapping.name && !mapping.last_name) {
    return NextResponse.json(
      { error: "Full name or last name mapping is required" },
      { status: 400 },
    );
  }

  if (!mapping.email && !mapping.mobile_phone && !mapping.office_phone) {
    return NextResponse.json(
      { error: "At least one of email, mobile phone, or office phone mapping is required" },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows provided for import" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const importBatchId = Date.now().toString(36).toUpperCase();
  const allHeaders = getAllHeaders(rows);
  const mappedColumns = getMappedColumns(mapping);
  const mappedFields = new Set(
    Object.entries(mapping)
      .filter(([, column]) => Boolean(column) && column !== SKIP_VALUE)
      .map(([field]) => field),
  );
  const contactCustomFields = await prismadb.custom_fields.findMany({
    orderBy: { createdAt: "asc" },
  });
  const extraHeaders = allHeaders
    .filter((header) => !mappedColumns.has(header))
    .filter((header) => hasAnyValue(rows, header));
  const {
    standardHeaders,
    customFieldHeaders,
    importedHeaders,
  } = classifyExtraHeaders(extraHeaders, contactCustomFields);
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const failures: Array<{ row: number; email: string | null; reason: string }> = [];
  const candidates: Array<{
    row: number;
    normalizedEmail: string;
    normalizedMobilePhone: string;
    normalizedOfficePhone: string;
    rawRow: RawRow;
    data: Record<string, string>;
  }> = [];

  const importedColumns = await ensureImportedContactColumns(importedHeaders);

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const detectedStandardValues = getDetectedStandardFieldValues(row, standardHeaders, mappedFields);
    const mappedData = Object.fromEntries(
      Object.entries(mapping)
        .filter(([, column]) => Boolean(column) && column !== SKIP_VALUE)
        .map(([field, column]) => [field, mappedValue(row, column)]),
    );
    const data = {
      ...detectedStandardValues,
      ...mappedData,
    };
    const email = data.email || "";
    const normalizedEmail = email ? normalizeEmail(email) : "";
    const firstName = data.first_name || "";
    const lastName = data.last_name || "";
    const fullName = data.name || "";
    const mobilePhone = data.mobile_phone || "";
    const officePhone = data.office_phone || "";
    const normalizedMobilePhone = mobilePhone ? normalizePhone(mobilePhone) : "";
    const normalizedOfficePhone = officePhone ? normalizePhone(officePhone) : "";
    const computedName = fullName || [firstName, lastName].filter(Boolean).join(" ");

    if (!computedName && !lastName) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because full name and last name are empty",
      });
      return;
    }

    if (!normalizedEmail && !normalizedMobilePhone && !normalizedOfficePhone) {
      failures.push({
        row: rowNumber,
        email: null,
        reason: "Skipped because email and phone fields are empty",
      });
      return;
    }

    if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail,
        reason: "Skipped because email format is invalid",
      });
      return;
    }

    if (normalizedMobilePhone && normalizedMobilePhone.replace(/\D/g, "").length < 7) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because mobile phone format is invalid",
      });
      return;
    }

    if (normalizedOfficePhone && normalizedOfficePhone.replace(/\D/g, "").length < 7) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because office phone format is invalid",
      });
      return;
    }

    if (normalizedEmail && seenEmails.has(normalizedEmail)) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail,
        reason: "Duplicate email found in uploaded file",
      });
      return;
    }

    if (
      (normalizedMobilePhone && seenPhones.has(normalizedMobilePhone)) ||
      (normalizedOfficePhone && seenPhones.has(normalizedOfficePhone))
    ) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Duplicate phone found in uploaded file",
      });
      return;
    }

    if (normalizedEmail) {
      seenEmails.add(normalizedEmail);
    }
    if (normalizedMobilePhone) {
      seenPhones.add(normalizedMobilePhone);
    }
    if (normalizedOfficePhone) {
      seenPhones.add(normalizedOfficePhone);
    }
    candidates.push({
      row: rowNumber,
      normalizedEmail,
      normalizedMobilePhone,
      normalizedOfficePhone,
      rawRow: row,
      data,
    });
  });

  const existingContacts = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          email: {
            in: candidates
              .map((candidate) => candidate.normalizedEmail)
              .filter(Boolean),
          },
        },
        {
          mobile_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedMobilePhone)
              .filter(Boolean),
          },
        },
        {
          mobile_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedOfficePhone)
              .filter(Boolean),
          },
        },
        {
          office_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedMobilePhone)
              .filter(Boolean),
          },
        },
        {
          office_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedOfficePhone)
              .filter(Boolean),
          },
        },
      ],
    },
    select: {
      id: true,
      serial: true,
      email: true,
      mobile_phone: true,
      office_phone: true,
      custom_fields_data: true,
    },
  });

  const existingByEmail = new Map<string, ExistingContactMatch>();
  const existingByPhone = new Map<string, ExistingContactMatch>();

  const uniqueAssignedUserValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.assigned_to?.trim()).filter(Boolean)),
  );
  const uniqueAccountValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.assigned_account?.trim()).filter(Boolean)),
  );
  const uniqueContactTypeValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.contact_type_id?.trim()).filter(Boolean)),
  );
  const uniqueLeadSourceValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.lead_source_id?.trim()).filter(Boolean)),
  );
  const uniqueLeadStatusValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.lead_status_id?.trim()).filter(Boolean)),
  );
  const uniqueLeadTypeValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.lead_type_id?.trim()).filter(Boolean)),
  );

  const [users, accounts, contactTypes, leadSources, leadStatuses, leadTypes] = await Promise.all([
    uniqueAssignedUserValues.length
      ? prismadb.users.findMany({
          where: {
            OR: [
              { id: { in: uniqueAssignedUserValues } },
              { email: { in: uniqueAssignedUserValues } },
              { name: { in: uniqueAssignedUserValues } },
            ],
          },
          select: { id: true, email: true, name: true },
        })
      : Promise.resolve([]),
    uniqueAccountValues.length
      ? prismadb.crm_Accounts.findMany({
          where: {
            deletedAt: null,
            OR: [{ id: { in: uniqueAccountValues } }, { name: { in: uniqueAccountValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueContactTypeValues.length
      ? prismadb.crm_Contact_Types.findMany({
          where: {
            OR: [{ id: { in: uniqueContactTypeValues } }, { name: { in: uniqueContactTypeValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueLeadSourceValues.length
      ? prismadb.crm_Lead_Sources.findMany({
          where: {
            OR: [{ id: { in: uniqueLeadSourceValues } }, { name: { in: uniqueLeadSourceValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueLeadStatusValues.length
      ? prismadb.crm_Lead_Statuses.findMany({
          where: {
            OR: [{ id: { in: uniqueLeadStatusValues } }, { name: { in: uniqueLeadStatusValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueLeadTypeValues.length
      ? prismadb.crm_Lead_Types.findMany({
          where: {
            OR: [{ id: { in: uniqueLeadTypeValues } }, { name: { in: uniqueLeadTypeValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const userLookup = new Map<string, string>();
  const accountLookup = new Map<string, string>();
  const contactTypeLookup = new Map<string, string>();
  const leadSourceLookup = new Map<string, string>();
  const leadStatusLookup = new Map<string, string>();
  const leadTypeLookup = new Map<string, string>();

  users.forEach((user) => {
    userLookup.set(user.id, user.id);
    if (user.email) userLookup.set(user.email, user.id);
    if (user.name) userLookup.set(user.name, user.id);
  });
  accounts.forEach((account) => {
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(normalizeLookupKey(account.name), account.id);
  });
  contactTypes.forEach((contactType) => {
    contactTypeLookup.set(contactType.id, contactType.id);
    contactTypeLookup.set(contactType.name, contactType.id);
    contactTypeLookup.set(normalizeLookupKey(contactType.name), contactType.id);
  });
  leadSources.forEach((leadSource) => {
    leadSourceLookup.set(leadSource.id, leadSource.id);
    leadSourceLookup.set(leadSource.name, leadSource.id);
    leadSourceLookup.set(normalizeLookupKey(leadSource.name), leadSource.id);
  });
  leadStatuses.forEach((leadStatus) => {
    leadStatusLookup.set(leadStatus.id, leadStatus.id);
    leadStatusLookup.set(leadStatus.name, leadStatus.id);
    leadStatusLookup.set(normalizeLookupKey(leadStatus.name), leadStatus.id);
  });
  leadTypes.forEach((leadType) => {
    leadTypeLookup.set(leadType.id, leadType.id);
    leadTypeLookup.set(leadType.name, leadType.id);
    leadTypeLookup.set(normalizeLookupKey(leadType.name), leadType.id);
  });

  existingContacts.forEach((contact) => {
    const normalizedEmail = contact.email ? normalizeEmail(contact.email) : "";
    const mobilePhone = contact.mobile_phone
      ? normalizePhone(contact.mobile_phone)
      : "";
    const officePhone = contact.office_phone
      ? normalizePhone(contact.office_phone)
      : "";

    if (normalizedEmail) {
      existingByEmail.set(normalizedEmail, {
        id: contact.id,
        serial: contact.serial,
        custom_fields_data: contact.custom_fields_data,
      });
    }
    if (mobilePhone) {
      existingByPhone.set(mobilePhone, {
        id: contact.id,
        serial: contact.serial,
        custom_fields_data: contact.custom_fields_data,
      });
    }
    if (officePhone) {
      existingByPhone.set(officePhone, {
        id: contact.id,
        serial: contact.serial,
        custom_fields_data: contact.custom_fields_data,
      });
    }
  });

  const missingAccountNames = uniqueAccountValues.filter((value) => {
    const trimmed = value.trim();
    return trimmed && !accountLookup.get(trimmed) && !accountLookup.get(normalizeLookupKey(trimmed));
  });
  const uniqueMissingAccountNames = Array.from(
    new Map(missingAccountNames.map((name) => [normalizeLookupKey(name), name.trim()])).values(),
  );

  for (const accountName of uniqueMissingAccountNames) {
    const account = await prismadb.crm_Accounts.create({
      data: {
        v: 0,
        name: accountName,
        status: "Active",
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true, name: true },
    });
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(normalizeLookupKey(account.name), account.id);
  }

  let imported = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existingMatch =
      (candidate.normalizedEmail
        ? existingByEmail.get(candidate.normalizedEmail)
        : undefined) ||
      (candidate.normalizedMobilePhone
        ? existingByPhone.get(candidate.normalizedMobilePhone)
        : undefined) ||
      (candidate.normalizedOfficePhone
        ? existingByPhone.get(candidate.normalizedOfficePhone)
        : undefined);

    if (existingMatch && duplicateMode === "skip") {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason: "Existing contact matched by email or phone",
      });
      continue;
    }

    const firstNameValue = candidate.data.first_name;
    const lastNameValue = candidate.data.last_name;
    const computedName = candidate.data.name || [firstNameValue, lastNameValue].filter(Boolean).join(" ");
    const { first_name, last_name } =
      firstNameValue || lastNameValue
        ? {
            first_name: firstNameValue || "",
            last_name:
              lastNameValue ||
              candidate.normalizedEmail.split("@")[0] ||
              candidate.normalizedMobilePhone ||
              candidate.normalizedOfficePhone ||
              "Imported Contact",
          }
        : splitFullName(
            computedName,
            candidate.normalizedEmail ||
              candidate.normalizedMobilePhone ||
              candidate.normalizedOfficePhone ||
              computedName,
          );

    const assignedToRaw = candidate.data.assigned_to?.trim() || "";
    const assignedAccountRaw =
      candidate.data.assigned_account?.trim() || candidate.data.accountsIDs?.trim() || "";
    const contactTypeRaw = candidate.data.contact_type_id?.trim() || "";
    const leadSourceRaw = candidate.data.lead_source_id?.trim() || "";
    const leadStatusRaw = candidate.data.lead_status_id?.trim() || "";
    const leadTypeRaw = candidate.data.lead_type_id?.trim() || "";
    const resolvedAssignedTo = assignedToRaw ? userLookup.get(assignedToRaw) : undefined;
    const resolvedAssignedAccount = assignedAccountRaw
      ? accountLookup.get(assignedAccountRaw) ?? accountLookup.get(normalizeLookupKey(assignedAccountRaw))
      : undefined;
    const resolvedContactType = contactTypeRaw
      ? contactTypeLookup.get(contactTypeRaw) ?? contactTypeLookup.get(normalizeLookupKey(contactTypeRaw))
      : undefined;
    const resolvedLeadSource = leadSourceRaw
      ? leadSourceLookup.get(leadSourceRaw) ?? leadSourceLookup.get(normalizeLookupKey(leadSourceRaw))
      : undefined;
    const resolvedLeadStatus = leadStatusRaw
      ? leadStatusLookup.get(leadStatusRaw) ?? leadStatusLookup.get(normalizeLookupKey(leadStatusRaw))
      : undefined;
    const resolvedLeadType = leadTypeRaw
      ? leadTypeLookup.get(leadTypeRaw) ?? leadTypeLookup.get(normalizeLookupKey(leadTypeRaw))
      : undefined;

    const parsedStatus = parseStatus(candidate.data.status || "");
    const inferredRoleFromIdentifier = inferContactRoleFromIdentifierContext(
      mapping.serial,
      mapping.role,
      candidate.data.role,
    );
    const resolvedRole =
      importRole ??
      detectContactRole(candidate.data.role) ??
      inferredRoleFromIdentifier ??
      "Customer";

    const normalizedRole = normalizeContactRole(resolvedRole);
    const customFieldsForRole = contactCustomFields.filter((field) =>
      fieldAppliesToEntity(field, "Contact", normalizedRole),
    );
    const customFieldValues = {
      ...getDetectedCustomFieldValues(candidate.rawRow, customFieldHeaders),
      ...getRoleCustomFieldValues(candidate.rawRow, customFieldsForRole),
    };
    const sanitizedCustomFieldValues = sanitizeCustomFieldValues(
      customFieldValues,
      customFieldsForRole,
    );
    const mergedCustomFieldValues =
      Object.keys(sanitizedCustomFieldValues).length > 0
        ? mergeCustomFieldValues(existingMatch?.custom_fields_data, sanitizedCustomFieldValues)
        : undefined;
    const importedColumnValues = Object.fromEntries(
      Array.from(importedColumns.entries()).flatMap(([header, column]) => {
        const value = getImportedColumnValue(candidate.rawRow, header);
        return value ? [[column, value] as const] : [];
      }),
    );
    const serial = findReferenceIdFromRow(candidate.rawRow, normalizedRole) ||
      parseSerial(candidate.data.serial || "");
    const resolvedSerial =
      serial ||
      existingMatch?.serial ||
      generateFallbackSerial(normalizedRole, candidate.row, importBatchId);
    const supportedSerialField = await pickExistingDbModelFields("crm_Contacts", {
      serial: resolvedSerial,
    });

    const contactPayload = {
      ...supportedSerialField,
      first_name: first_name || undefined,
      last_name,
      email: candidate.normalizedEmail || undefined,
      personal_email: normalizeOptionalText(candidate.data.personal_email),
      mobile_phone: candidate.normalizedMobilePhone || undefined,
      office_phone: candidate.normalizedOfficePhone || undefined,
      website: normalizeOptionalText(candidate.data.website),
      position: normalizeOptionalText(candidate.data.position),
      description: normalizeOptionalText(candidate.data.description),
      company: normalizeOptionalText(candidate.data.company),
      jobTitle: normalizeOptionalText(candidate.data.jobTitle),
      phone: normalizeOptionalText(candidate.data.phone),
      birthday: normalizeOptionalText(candidate.data.birthday),
      address: normalizeOptionalText(candidate.data.address),
      address_line1: normalizeOptionalText(candidate.data.address_line1),
      address_line2: normalizeOptionalText(candidate.data.address_line2),
      city: normalizeOptionalText(candidate.data.city),
      state: normalizeOptionalText(candidate.data.state),
      country: normalizeOptionalText(candidate.data.country),
      postal_code: normalizeOptionalText(candidate.data.postal_code),
      status: parsedStatus ?? true,
      assigned_to: resolvedAssignedTo,
      accountsIDs: resolvedAssignedAccount,
      contact_type_id: resolvedContactType,
      lead_source_id: resolvedLeadSource,
      lead_status_id: resolvedLeadStatus,
      lead_type_id: resolvedLeadType,
      refered_by: normalizeOptionalText(candidate.data.refered_by),
      campaign: normalizeOptionalText(candidate.data.campaign),
      social_twitter: normalizeOptionalText(candidate.data.social_twitter),
      social_facebook: normalizeOptionalText(candidate.data.social_facebook),
      social_linkedin: normalizeOptionalText(candidate.data.social_linkedin),
      social_skype: normalizeOptionalText(candidate.data.social_skype),
      social_instagram: normalizeOptionalText(candidate.data.social_instagram),
      social_youtube: normalizeOptionalText(candidate.data.social_youtube),
      social_tiktok: normalizeOptionalText(candidate.data.social_tiktok),
      custom_fields_data: mergedCustomFieldValues,
      ...(await pickExistingDbModelFields("crm_Contacts", {
        role: normalizedRole,
      })),
    };

    try {
      if (existingMatch) {
        await prismadb.crm_Contacts.update({
          where: { id: existingMatch.id },
          data: {
            updatedBy: userId,
            ...contactPayload,
          } as any,
          select: { id: true },
        });
        await updateImportedContactColumns(existingMatch.id, importedColumnValues);
        updated += 1;
      } else {
        const created = await prismadb.crm_Contacts.create({
          data: {
            v: 1,
            createdBy: userId,
            updatedBy: userId,
            ...contactPayload,
            tags: [],
            notes: [],
          } as any,
          select: { id: true },
        });
        await updateImportedContactColumns(created.id, importedColumnValues);

        if (candidate.normalizedEmail) {
          existingByEmail.set(candidate.normalizedEmail, {
            id: created.id,
            serial: resolvedSerial,
            custom_fields_data: mergedCustomFieldValues,
          });
        }
        if (candidate.normalizedMobilePhone) {
          existingByPhone.set(candidate.normalizedMobilePhone, {
            id: created.id,
            serial: resolvedSerial,
            custom_fields_data: mergedCustomFieldValues,
          });
        }
        if (candidate.normalizedOfficePhone) {
          existingByPhone.set(candidate.normalizedOfficePhone, {
            id: created.id,
            serial: resolvedSerial,
            custom_fields_data: mergedCustomFieldValues,
          });
        }
        imported += 1;
      }
    } catch (error) {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason:
          error instanceof Error
            ? error.message
            : "Failed to create contact",
      });
    }
  }

  if (imported > 0 || updated > 0) {
    await writeAuditLog({
      entityType: "contact",
      entityId: "bulk_import",
      action: "imported",
      changes: [
        { field: "imported", old: null, new: imported },
        { field: "updated", old: null, new: updated },
        { field: "duplicateMode", old: null, new: duplicateMode },
      ],
      userId,
    });
  }

  revalidatePath("/[locale]/crm/contacts", "page");

  return NextResponse.json({
    imported,
    updated,
    failed: failures.length,
    failures,
  });
}
