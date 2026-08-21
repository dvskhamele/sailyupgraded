import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

import {
  fieldAppliesToEntity,
  normalizeCustomField,
  type CustomFieldDefinition,
  type CustomFieldContactRole,
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
  "id", "v", "created_by", "createdBy", "cratedAt",
  "updatedAt", "updatedBy", "last_activity", "last_activity_by",
  "deletedAt", "deletedBy", "custom_fields_data", "tags",
  // "account" is a legacy duplicate of accountsIDs — exclude to avoid confusion
  "account",
  // role is handled separately via contactType; visible_to_name is UI-only
  "visible_to_name",
]);

const LABELS: Record<string, string> = {
  // Identity
  serial: "Agent ID",
  role: "Role",
  agent_level: "Agent Level",
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
  // Date Entered
  created_on: "Date Entered",
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

export function getAgentSpreadsheetFields(
  customFields: CustomFieldDefinition[] = [],
  contactRole?: CustomFieldContactRole | null,
) {
  const contact = Prisma.dmmf.datamodel.models.find((model) => model.name === "crm_Contacts");
  const standard: AgentSpreadsheetField[] = (contact?.fields ?? [])
    .filter((field) => (field.kind === "scalar" || field.kind === "enum") && !INTERNAL_CONTACT_COLUMNS.has(field.name))
    .map((field) => ({
      key: field.name,
      label: LABELS[field.name] ?? titleCase(field.name),
      type: field.name === "notes" ? "textarea" : RELATIONSHIP_FIELDS.has(field.name) ? "relationship" : field.type,
    }));
  const custom = customFields
    .filter((field) => fieldAppliesToEntity(field, "Contact", contactRole))
    .map(normalizeCustomField)
    .map((field) => ({ key: `custom:${field.id}`, label: field.name, type: field.type, custom: true }));

  return [...standard, ...custom];
}

export function normalizeSpreadsheetHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Supports generated labels plus the legacy nine-column workbooks. */
export function getAgentSpreadsheetHeaderMap(
  customFields: CustomFieldDefinition[] = [],
  contactRole?: CustomFieldContactRole | null,
) {
  const map = new Map<string, string>();

  // Apply aliases FIRST so that custom fields and standard label lookups
  // take priority over alias entries.
  const aliases: Record<string, string> = {
    // Identity & Agent Number
    agentid: "serial", agentcode: "serial", reference: "serial", referencenumber: "serial", referenceid: "serial",
    agentnumber: "serial", agentno: "serial", agentnum: "serial", agent_number: "serial",
    contactid: "serial", customerid: "serial", clientid: "serial",

    // Name
    firstname: "first_name", first_name: "first_name", givenname: "first_name", forename: "first_name",
    lastname: "last_name", last_name: "last_name", familyname: "last_name", surname: "last_name",
    fullname: "first_name", contactname: "first_name", name: "first_name",

    // Contact info
    email: "email", emailaddress: "email", e_mail: "email", mail: "email",
    personalemail: "personal_email", privatemail: "personal_email", privateemail: "personal_email",
    phone: "phone", phonenumber: "phone", contactnumber: "phone",
    mobile: "mobile_phone", mobilephone: "mobile_phone", mobilephonenumber: "mobile_phone",
    cell: "mobile_phone", cellphone: "mobile_phone", cellphonenumber: "mobile_phone",
    officephone: "office_phone", officephonenumber: "office_phone", workphone: "office_phone", work: "office_phone", telephone: "office_phone", tel: "office_phone",
    website: "website", web: "website", site: "website", webaddress: "website", url: "website",

    // Professional & Assignment
    company: "company", companyname: "company", organization: "company", organisation: "company", org: "company",
    jobtitle: "jobTitle", title: "position", position: "position", positiontitle: "position", designation: "position",
    assignedaccount: "accountsIDs", account: "accountsIDs", accountname: "accountsIDs", assignedcompany: "accountsIDs",
    assignedmember: "assigned_to", assignedto: "assigned_to", owner: "assigned_to", user: "assigned_to", assignee: "assigned_to",
    visibility: "visible_to_name", visibleto: "visible_to_name", visible_to: "visible_to_name",

    // Agent Level & Dates
    percentlevel: "agent_level", level: "agent_level", agentlevel: "agent_level", "%level": "agent_level", agenttier: "agent_level", agentrank: "agent_level",
    dateentered: "created_on", daterecruited: "created_on", datecreated: "created_on", entereddate: "created_on", recruiteddate: "created_on",
    dateofbirth: "birthday", birthdate: "birthday", dob: "birthday", birthday: "birthday", birth_date: "birthday", date_of_birth: "birthday",

    // Recruiter & Lead classification
    recruitername: "recruiter_name", recruiter: "recruiter_name", recruiter_name: "recruiter_name",
    contacttype: "contact_type_id", contactcategory: "contact_type_id", contact_type: "contact_type_id",
    leadsource: "lead_source_id", source: "lead_source_id", lead_source: "lead_source_id",
    leadstatus: "lead_status_id", lead_status: "lead_status_id",
    leadtype: "lead_type_id", lead_type: "lead_type_id",
    referredby: "refered_by", referedby: "refered_by", referrer: "refered_by", referral: "refered_by", referred_by: "refered_by",
    campaign: "campaign",

    // Status
    status: "status", agentstatus: "status", statusfield: "status", isactive: "status", activeinactive: "status", active: "status",
    role: "role", rolefield: "role", contactrole: "role",

    // Address
    address: "address", fulladdress: "address", completeaddress: "address",
    street: "address_line1", streetaddress: "address_line1", address1: "address_line1", addressline1: "address_line1", addresslineone: "address_line1",
    address2: "address_line2", addressline2: "address_line2", addresslinetwo: "address_line2", suite: "address_line2", apartment: "address_line2",
    city: "city", cityname: "city", town: "city",
    state: "state", statename: "state", region: "state", province: "state",
    country: "country", countryname: "country",
    zip: "postal_code", zipcode: "postal_code", pincode: "postal_code", postcode: "postal_code", postalcode: "postal_code", postal_code: "postal_code",

    // Notes & description
    notes: "notes", note: "notes", internalnotes: "notes", remarks: "notes", comments: "notes",
    description: "description", descriptionfield: "description", about: "description", summary: "description", details: "description",

    // Social & Photo
    twitter: "social_twitter", x: "social_twitter", twitterhandle: "social_twitter", twitterurl: "social_twitter",
    facebook: "social_facebook", facebookurl: "social_facebook", facebookpage: "social_facebook",
    linkedin: "social_linkedin", linkedinprofile: "social_linkedin", linkedinurl: "social_linkedin",
    thread: "social_skype", threads: "social_skype", skype: "social_skype", skypeid: "social_skype", threadhandle: "social_skype",
    instagram: "social_instagram", instagramhandle: "social_instagram", instagramurl: "social_instagram",
    youtube: "social_youtube", youtubechannel: "social_youtube", youtubeurl: "social_youtube",
    tiktok: "social_tiktok", tiktokhandle: "social_tiktok", tiktokurl: "social_tiktok",
    agentphoto: "agent_photo", photo: "agent_photo", avatar: "agent_photo", picture: "agent_photo", image: "agent_photo",
  };
  for (const [header, key] of Object.entries(aliases)) map.set(header, key);

  // Standard fields and custom fields override aliases.
  for (const field of getAgentSpreadsheetFields(customFields, contactRole)) {
    map.set(normalizeSpreadsheetHeader(field.label), field.key);
    map.set(normalizeSpreadsheetHeader(field.key), field.key);
    if (field.custom && field.key.startsWith("custom:")) {
      const fieldId = field.key.slice("custom:".length);
      map.set(normalizeSpreadsheetHeader(fieldId), field.key);
      map.set(fieldId, field.key);
      map.set(field.key, field.key);
      map.set(normalizeSpreadsheetHeader(`custom_${field.label}`), field.key);
      map.set(normalizeSpreadsheetHeader(`custom_field_${field.label}`), field.key);
    }
  }
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

// ---------------------------------------------------------------------------
// 32-Column Agent Excel Download Template & Dummy Foreign Client Row
// ---------------------------------------------------------------------------

export const AGENT_IMPORT_TEMPLATE_COLUMNS = [
  "Agent Photo",
  "FirstName",
  "LastName",
  "City",
  "State",
  "Zipcode",
  "CellPhone",
  "Email",
  "AgentNumber",
  "AgentStatus",
  "Date Recruited",
  "AgentLevel",
  "Address",
  "Recruiter Name",
  "Date of Birth",
  "ASSIGNED TO",
  "Visibility",
  "Website",
  "Lead Source",
  "Lead Type",
  "Referred By",
  "Campaign",
  "Twitter",
  "Facebook",
  "LinkedIn",
  "Thread",
  "Instagram",
  "YouTube",
  "TikTok",
  "Notes",
  "Assigned Company",
  "Country",
] as const;

export const AGENT_IMPORT_TEMPLATE_DUMMY_ROW = [
  "", // 1. Agent Photo
  "Sophia", // 2. FirstName
  "Anderson", // 3. LastName
  "New York", // 4. City
  "NY", // 5. State
  "10001", // 6. Zipcode
  "+1-212-555-0199", // 7. CellPhone
  "sophia.anderson@example.com", // 8. Email
  "NAA550001", // 9. AgentNumber
  "Active", // 10. AgentStatus
  "2026-07-15", // 11. Date Recruited
  "55", // 12. AgentLevel
  "125 Madison Avenue", // 13. Address
  "John Carter", // 14. Recruiter Name
  "1990-05-20", // 15. Date of Birth
  "Manager A", // 16. ASSIGNED TO
  "Public", // 17. Visibility
  "https://www.example.com/agents/sophia-anderson", // 18. Website
  "LinkedIn", // 19. Lead Source
  "Inbound", // 20. Lead Type
  "Global Realty Partner", // 21. Referred By
  "US Real Estate Campaign 1", // 22. Campaign
  "https://twitter.com/sophiaanderson", // 23. Twitter
  "https://facebook.com/sophia.anderson", // 24. Facebook
  "https://linkedin.com/in/sophia-anderson", // 25. LinkedIn
  "https://threads.net/@sophiaanderson", // 26. Thread
  "https://instagram.com/sophiaanderson", // 27. Instagram
  "https://youtube.com/@sophiaanderson", // 28. YouTube
  "https://tiktok.com/@sophiaanderson", // 29. TikTok
  "Dummy foreign client record for import testing.", // 30. Notes
  "NorthStar Realty", // 31. Assigned Company
  "United States", // 32. Country
];

export function createAgentTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheetData = [
    [...AGENT_IMPORT_TEMPLATE_COLUMNS],
    [...AGENT_IMPORT_TEMPLATE_DUMMY_ROW],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set explicit string cell types on dummy row to preserve string typing for Zipcode, CellPhone, AgentNumber, etc.
  for (let c = 0; c < AGENT_IMPORT_TEMPLATE_COLUMNS.length; c++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 1, c });
    const cell = sheet[cellAddress];
    if (cell) {
      cell.t = "s";
      cell.v = String(AGENT_IMPORT_TEMPLATE_DUMMY_ROW[c] ?? "");
    }
  }

  XLSX.utils.book_append_sheet(workbook, sheet, "Agents");
  return workbook;
}
