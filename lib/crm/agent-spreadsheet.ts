import { Prisma } from "@prisma/client";

import {
  fieldAppliesToEntity,
  normalizeCustomField,
  type CustomFieldDefinition,
} from "@/lib/custom-fields";

export type AgentSpreadsheetField = {
  key: string;
  label: string;
  type: string;
  custom?: boolean;
};

// These are audit/internal columns rather than Agent form fields.  Every other
// scalar column is discovered from Prisma, so schema additions automatically
// become spreadsheet columns.
const INTERNAL_CONTACT_COLUMNS = new Set([
  "id", "v", "created_by", "createdBy", "created_on", "cratedAt",
  "updatedAt", "updatedBy", "last_activity", "last_activity_by",
  "deletedAt", "deletedBy", "custom_fields_data", "tags",
  // "account" is a legacy duplicate of accountsIDs — exclude to avoid confusion
  "account",
]);

const LABELS: Record<string, string> = {
  // Identity
  serial: "Agent ID",
  role: "Role",
  // Name
  first_name: "First Name",
  last_name: "Last Name",
  // Contact info
  email: "Email",
  personal_email: "Personal Email",
  phone: "Phone",
  mobile_phone: "Mobile Phone",
  office_phone: "Office Phone",
  website: "Website",
  // Professional
  company: "Company",
  jobTitle: "Job Title",
  position: "Position",
  // Assignment
  assigned_to: "Assigned Member",
  accountsIDs: "Assigned Company",
  visible_to_name: "Visibility",
  // Lead classification
  contact_type_id: "Contact Type",
  lead_source_id: "Lead Source",
  lead_status_id: "Lead Status",
  lead_type_id: "Lead Type",
  refered_by: "Referred By",
  campaign: "Campaign",
  // Status
  status: "Status",
  // Birthday (stored as single string in DB)
  birthday: "Birthday",
  // Address
  address_line1: "Address Line 1",
  address_line2: "Address Line 2",
  address: "Address",
  city: "City",
  state: "State",
  country: "Country",
  postal_code: "Postal Code",
  // Notes & description
  description: "Description",
  notes: "Notes",
  // Social
  social_twitter: "Twitter",
  social_facebook: "Facebook",
  social_linkedin: "LinkedIn",
  social_skype: "Thread",
  social_instagram: "Instagram",
  social_youtube: "YouTube",
  social_tiktok: "TikTok",
};

const RELATIONSHIP_FIELDS = new Set([
  "assigned_to", "accountsIDs", "contact_type_id", "lead_source_id",
  "lead_status_id", "lead_type_id",
]);

function titleCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getAgentSpreadsheetFields(customFields: CustomFieldDefinition[] = []) {
  const contact = Prisma.dmmf.datamodel.models.find((model) => model.name === "crm_Contacts");
  const standard: AgentSpreadsheetField[] = (contact?.fields ?? [])
    .filter((field) => (field.kind === "scalar" || field.kind === "enum") && !INTERNAL_CONTACT_COLUMNS.has(field.name))
    .map((field) => ({
      key: field.name,
      label: LABELS[field.name] ?? titleCase(field.name),
      type: field.name === "notes" ? "textarea" : RELATIONSHIP_FIELDS.has(field.name) ? "relationship" : field.type,
    }));
  const custom = customFields
    .filter((field) => fieldAppliesToEntity(field, "Contact", "Agent"))
    .map(normalizeCustomField)
    .map((field) => ({ key: `custom:${field.id}`, label: field.name, type: field.type, custom: true }));

  return [...standard, ...custom];
}

export function normalizeSpreadsheetHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Supports generated labels plus the legacy nine-column workbooks. */
export function getAgentSpreadsheetHeaderMap(customFields: CustomFieldDefinition[] = []) {
  const map = new Map<string, string>();
  for (const field of getAgentSpreadsheetFields(customFields)) {
    map.set(normalizeSpreadsheetHeader(field.label), field.key);
    map.set(normalizeSpreadsheetHeader(field.key), field.key);
  }
  const aliases: Record<string, string> = {
    firstname: "first_name", lastname: "last_name", emailaddress: "email",
    fullname: "first_name", contactname: "first_name",
    mobile: "mobile_phone", mobilephone: "mobile_phone", officephone: "office_phone",
    companyname: "company", jobtitle: "jobTitle", title: "position",
    assignedaccount: "accountsIDs", account: "accountsIDs", accountname: "accountsIDs",
    assignedmember: "assigned_to", owner: "assigned_to", user: "assigned_to",
  };
  for (const [header, key] of Object.entries(aliases)) map.set(header, key);
  return map;
}

export function isAgentSpreadsheetImportable(field: AgentSpreadsheetField) {
  // A file value is metadata produced by the upload service; an Excel cell cannot
  // safely recreate it. It is exported for visibility and explicitly reported on import.
  return field.type !== "file" && (field.type !== "Json" || field.key === "notes");
}

export function formatAgentSpreadsheetValue(field: AgentSpreadsheetField, value: unknown) {
  if (value == null) return "";
  if (field.type === "Boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const file = value as { url?: string; name?: string };
    return file.url ?? file.name ?? JSON.stringify(value);
  }
  return String(value);
}
