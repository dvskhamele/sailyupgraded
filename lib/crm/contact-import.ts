export type MappingKey =
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

export type ColumnMapping = Record<MappingKey, string>;

export const SKIP_VALUE = "__skip__";

export const AUTO_MAP_CANDIDATES: Record<MappingKey, string[]> = {
  serial: [
    "serial",
    "sr no",
    "sr_no",
    "sequence",
    "agent number",
    "agent no",
    "agent id",
    "customer id",
    "customer number",
    "client id",
    "partner id",
    "partner number",
    "vendor id",
    "vendor number",
  ],
  name: ["full name", "full_name", "contact name", "person name", "lead name"],
  first_name: ["first name", "firstname", "first_name", "given name", "forename"],
  last_name: ["last name", "lastname", "last_name", "surname", "family name"],
  email: ["email", "e-mail", "email address", "mail", "work email", "official email"],
  personal_email: ["personal email", "personal_email", "private email", "home email"],
  mobile_phone: ["mobile", "mobile phone", "mobile_phone", "cell", "cell phone", "whatsapp"],
  office_phone: ["office phone", "office_phone", "telephone", "tel", "work phone", "phone", "landline"],
  website: ["website", "web", "url", "site", "company website"],
  position: ["position", "job title", "title", "designation", "job role"],
  description: ["description", "notes", "note", "details", "remarks", "comment"],
  birthday: ["birthday", "birth date", "birthdate", "dob", "date of birth"],
  address: ["address", "full address", "complete address"],
  address_line1: ["address line 1", "address_line1", "street", "street 1", "address1"],
  address_line2: ["address line 2", "address_line2", "street 2", "address2"],
  city: ["city", "town"],
  state: ["state", "region", "province"],
  country: ["country", "nation"],
  postal_code: ["postal code", "postal_code", "zip", "zip code", "pincode", "pin code"],
  status: ["status", "active", "is active", "is_active"],
  role: ["role", "contact role", "contact type role"],
  contact_type_id: ["contact type", "contact_type", "contact_type_id", "type"],
  assigned_to: ["assigned to", "assigned_to", "owner", "user", "assignee", "assigned user"],
  assigned_account: [
    "assigned account",
    "assigned_account",
    "assigned company",
    "account",
    "account name",
    "company",
    "company name",
    "company_name",
    "organization",
    "organisation",
    "business name",
  ],
  social_twitter: ["twitter", "x", "twitter url"],
  social_facebook: ["facebook", "facebook url"],
  social_linkedin: ["linkedin", "linkedin url", "linkedin profile"],
  social_skype: ["skype", "skype id"],
  social_youtube: ["youtube", "youtube url"],
  social_tiktok: ["tiktok", "tik tok", "tiktok url"],
};

export function normalizeImportHeader(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeImportHeaderToken(value: string) {
  return normalizeImportHeader(value).replace(/[^a-z0-9]/g, "");
}

export function buildDefaultContactImportMapping() {
  return Object.fromEntries(
    (Object.keys(AUTO_MAP_CANDIDATES) as MappingKey[]).map((key) => [key, SKIP_VALUE]),
  ) as ColumnMapping;
}

function getCandidateScore(header: string, candidate: string) {
  const normalizedHeader = normalizeImportHeaderToken(header);
  const normalizedCandidate = normalizeImportHeaderToken(candidate);

  if (!normalizedHeader || !normalizedCandidate) {
    return 0;
  }

  if (normalizedHeader === normalizedCandidate) {
    return 1000 + normalizedCandidate.length;
  }

  if (normalizedHeader.startsWith(normalizedCandidate)) {
    return 700 + normalizedCandidate.length;
  }

  if (normalizedHeader.includes(normalizedCandidate)) {
    return 400 + normalizedCandidate.length;
  }

  return 0;
}

export function suggestContactImportMapping(headers: string[]): ColumnMapping {
  const mapping = buildDefaultContactImportMapping();
  const usedHeaders = new Set<string>();
  const fields = Object.keys(AUTO_MAP_CANDIDATES) as MappingKey[];

  for (const header of headers) {
    let bestField: MappingKey | null = null;
    let bestScore = 0;

    for (const field of fields) {
      const fieldScore = Math.max(
        ...AUTO_MAP_CANDIDATES[field].map((candidate) => getCandidateScore(header, candidate)),
      );

      if (fieldScore > bestScore) {
        bestScore = fieldScore;
        bestField = field;
      }
    }

    if (!bestField || bestScore === 0 || usedHeaders.has(header)) {
      continue;
    }

    if (mapping[bestField] === SKIP_VALUE) {
      mapping[bestField] = header;
      usedHeaders.add(header);
    }
  }

  return mapping;
}
