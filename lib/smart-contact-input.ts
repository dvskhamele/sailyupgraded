import type { UnifiedPersonFormValues } from "@/components/crm/unified-person-form";
import type { ContactRole } from "@/lib/contact-options";

type NamedOption = { id: string; name: string };

type SmartContactOptions = {
  accounts?: NamedOption[];
  contactTypes?: NamedOption[];
  leadSources?: NamedOption[];
  leadStatuses?: NamedOption[];
  leadTypes?: NamedOption[];
  assignedTo?: string;
};

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
]);

const STATE_BY_ABBR: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const ZIP_TO_LOCATION: Record<string, { city: string; state: string }> = {
  "75001": { city: "Addison", state: "Texas" },
  "75002": { city: "Allen", state: "Texas" },
  "75006": { city: "Carrollton", state: "Texas" },
  "75024": { city: "Plano", state: "Texas" },
  "75032": { city: "Forney", state: "Texas" },
  "75034": { city: "Frisco", state: "Texas" },
  "75067": { city: "Lewisville", state: "Texas" },
  "75069": { city: "McKinney", state: "Texas" },
  "75070": { city: "McKinney", state: "Texas" },
  "75074": { city: "Richardson", state: "Texas" },
  "73301": { city: "Austin", state: "Texas" },
  "75080": { city: "Richardson", state: "Texas" },
  "90001": { city: "Los Angeles", state: "California" },
  "10001": { city: "New York", state: "New York" },
  "33101": { city: "Miami", state: "Florida" },
};

const AREA_CODE_TO_STATE: Record<string, string> = {
  "212": "New York",
  "213": "California",
  "214": "Texas",
  "305": "Florida",
  "312": "Illinois",
  "415": "California",
  "512": "Texas",
  "602": "Arizona",
  "702": "Nevada",
  "713": "Texas",
  "713": "Texas",
  "805": "California",
  "818": "California",
};

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanValue(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\u00a0/g, " ")
      .replace(/[<>]/g, " ")
  );
}

function extractEmail(text: string) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0]?.trim().toLowerCase() ?? "";
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (raw.trim().startsWith("+")) {
    return `+${digits}`;
  }
  return digits;
}

function extractPhones(text: string) {
  const candidates = text.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) ?? [];
  return Array.from(
    new Set(candidates.map((candidate) => normalizePhone(candidate)).filter(Boolean)),
  );
}

function extractZip(text: string) {
  return text.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? "";
}

function extractDOB(text: string) {
  const match = text.match(/\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/);
  if (!match) return {};

  const value = match[0];
  const parts = value.includes("-") ? value.split("-") : value.split("/");
  if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return {
      birthday_year: parts[0],
      birthday_month: String(Number(parts[1])),
      birthday_day: String(Number(parts[2])),
    };
  }

  return {
    birthday_year: parts[2],
    birthday_month: String(Number(parts[0])),
    birthday_day: String(Number(parts[1])),
  };
}

function extractFieldByLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`(?:^|\\n|\\r|\\b)${label}\\s*[:\\-]?\\s*([^\\n\\r|]+)`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return cleanValue(match[1]);
    }
  }
  return "";
}

function inferCompany(text: string, email: string) {
  const labelMatch = extractFieldByLabel(text, ["company", "company name", "employer", "business"]);
  if (labelMatch) {
    return titleCase(labelMatch);
  }

  if (!email) return "";
  const domain = email.split("@")[1] ?? "";
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return "";

  const base = domain.replace(/^www\./i, "").split(".")[0] ?? "";
  return titleCase(base.replace(/[-_]/g, " "));
}

function generateEmail(firstName: string, lastName: string) {
  const localPart = [firstName, lastName]
    .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9]+/g, "."))
    .filter(Boolean)
    .join(".");

  return `${localPart || "contact"}@gmail.com`;
}

function inferName(text: string, email: string) {
  const labelMatch = extractFieldByLabel(text, ["name", "full name", "contact name", "person"]);
  if (labelMatch) {
    const cleaned = labelMatch.replace(/\b(?:email|phone|mobile|company|role|title)\b.*$/i, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        first_name: titleCase(parts.slice(0, -1).join(" ")),
        last_name: titleCase(parts.at(-1) ?? ""),
      };
    }
    if (parts.length === 1) {
      return {
        first_name: "",
        last_name: titleCase(parts[0]),
      };
    }
  }

  const beforeEmail = email ? text.split(email)[0] : "";
  const candidate = beforeEmail
    .split(/[\n|,;/]/)
    .map((part) => cleanValue(part))
    .filter(Boolean)
    .pop() ?? "";

  const candidateParts = candidate.split(/\s+/).filter(Boolean);
  if (candidateParts.length >= 2) {
    return {
      first_name: titleCase(candidateParts.slice(0, -1).join(" ")),
      last_name: titleCase(candidateParts.at(-1) ?? ""),
    };
  }

  if (email) {
    const localPart = email.split("@")[0] ?? "";
    const nameParts = localPart.split(/[._-]+/).filter(Boolean);
    if (nameParts.length >= 2) {
      return {
        first_name: titleCase(nameParts[0] ?? ""),
        last_name: titleCase(nameParts.slice(1).join(" ")),
      };
    }
    if (nameParts.length === 1) {
      return {
        first_name: "",
        last_name: titleCase(nameParts[0]),
      };
    }
  }

  return { first_name: "", last_name: "Unknown" };
}

function inferRole(text: string): ContactRole {
  const normalized = text.toLowerCase();
  if (/(referral|referred|agent|broker|license|downline)/i.test(normalized)) {
    return "Agent";
  }
  if (/(vendor|supplier)/i.test(normalized)) {
    return "Vendor";
  }
  if (/(partner|partnership)/i.test(normalized)) {
    return "Partner";
  }
  return "Customer";
}

function inferLeadSource(text: string) {
  const normalized = text.toLowerCase();
  if (/(referred|referral)/i.test(normalized)) return "Referral";
  if (/(linkedin\.com|linkedin|facebook\.com|facebook|instagram|tiktok|twitter\.com|x\.com)/i.test(normalized)) {
    return "Web";
  }
  if (/@/.test(normalized)) return "Web";
  return "Web";
}

function inferCityStateZip(text: string, phone: string) {
  const zip = extractZip(text);
  if (zip) {
    const location = ZIP_TO_LOCATION[zip];
    if (location) {
      return {
        city: location.city,
        state: location.state,
        postal_code: zip,
      };
    }
  }

  const cityMatch = extractFieldByLabel(text, ["city", "town"]);
  const stateMatch = extractFieldByLabel(text, ["state"]);
  const areaCode = phone.replace(/\D/g, "").slice(-10).slice(0, 3);
  const mappedState = AREA_CODE_TO_STATE[areaCode];

  const city = cityMatch ? titleCase(cityMatch) : "";
  const stateFromCity =
    city.toLowerCase() === "dallas" ? "Texas" :
    city.toLowerCase() === "miami" ? "Florida" :
    city.toLowerCase() === "austin" ? "Texas" :
    city.toLowerCase() === "los angeles" ? "California" :
    city.toLowerCase() === "new york" ? "New York" :
    "";

  const state = stateMatch
    ? STATE_BY_ABBR[stateMatch.toUpperCase()] ?? titleCase(stateMatch)
    : mappedState ?? stateFromCity;

  return {
    city,
    state,
    postal_code: "",
  };
}

function inferSocialLinks(text: string) {
  const linkedin =
    text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] ??
    text.match(/\blinkedin\.com\/in\/[A-Za-z0-9._-]+/i)?.[0] ??
    "";
  const twitter =
    text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s)]+/i)?.[0] ??
    text.match(/\b(?:twitter|x)\.com\/[A-Za-z0-9._-]+/i)?.[0] ??
    "";
  const facebook =
    text.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s)]+/i)?.[0] ??
    text.match(/\bfacebook\.com\/[A-Za-z0-9._-]+/i)?.[0] ??
    "";
  const instagram =
    text.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s)]+/i)?.[0] ??
    text.match(/\binstagram\.com\/[A-Za-z0-9._-]+/i)?.[0] ??
    "";
  const youtube =
    text.match(/https?:\/\/(?:www\.)?youtube\.com\/[^\s)]+/i)?.[0] ??
    text.match(/\byoutube\.com\/[A-Za-z0-9._@/-]+/i)?.[0] ??
    "";
  const tiktok =
    text.match(/https?:\/\/(?:www\.)?tiktok\.com\/[^\s)]+/i)?.[0] ??
    text.match(/\btiktok\.com\/[A-Za-z0-9._@/-]+/i)?.[0] ??
    "";
  const skype =
    text.match(/\bskype[:\s-]*([A-Za-z0-9._:-]+)/i)?.[1] ??
    text.match(/\blive:[A-Za-z0-9._:-]+/i)?.[0] ??
    "";

  return {
    social_linkedin: linkedin,
    social_twitter: twitter,
    social_facebook: facebook,
    social_instagram: instagram,
    social_youtube: youtube,
    social_tiktok: tiktok,
    social_skype: skype,
  };
}

function pickOptionId(options: NamedOption[] | undefined, names: string[]) {
  const normalizedNames = names.map((name) => name.toLowerCase());
  return options?.find((option) => normalizedNames.includes(option.name.toLowerCase()))?.id
    ?? options?.[0]?.id
    ?? "";
}

function matchAccountId(company: string, accounts: NamedOption[] | undefined) {
  if (!company) return "";
  const normalizedCompany = company.toLowerCase();
  return (
    accounts?.find((account) => account.name.toLowerCase().includes(normalizedCompany) || normalizedCompany.includes(account.name.toLowerCase()))?.id
    ?? ""
  );
}

export function buildSmartContactInitialValues(
  input: string,
  options: SmartContactOptions = {},
): Partial<UnifiedPersonFormValues> {
  const text = cleanValue(input);
  const email = extractEmail(text);
  const phones = extractPhones(text);
  const name = inferName(text, email);
  const resolvedEmail = email || generateEmail(name.first_name, name.last_name);
  const company = inferCompany(text, email);
  const location = inferCityStateZip(text, phones[0] ?? "");
  const role = inferRole(text);
  const leadSourceName = inferLeadSource(text);
  const social = inferSocialLinks(text);
  const dob = extractDOB(text);
  const description = text.slice(0, 240);

  const contactTypeName =
    role === "Agent" ? "Partner" : role === "Vendor" ? "Vendor" : role === "Partner" ? "Partner" : "Customer";

  const firstPhone = phones[0] ?? "";
  const secondPhone = phones[1] ?? "";

  return {
    serial: "1",
    first_name: name.first_name,
    last_name: name.last_name,
    company,
    email: resolvedEmail,
    personal_email: !GENERIC_EMAIL_DOMAINS.has(resolvedEmail.split("@")[1] ?? "") ? resolvedEmail : "",
    phone: firstPhone,
    mobile_phone: firstPhone,
    office_phone: secondPhone,
    description,
    address_line1: extractFieldByLabel(text, ["address", "address line 1", "address1", "street"]),
    address_line2: extractFieldByLabel(text, ["address line 2", "address2", "suite", "apt", "apartment"]),
    city: location.city,
    state: location.state,
    country: "United States",
    postal_code: location.postal_code,
    position: extractFieldByLabel(text, ["position", "title", "job title"]),
    jobTitle: extractFieldByLabel(text, ["job title", "title", "position"]),
    role,
    contact_type_id: pickOptionId(options.contactTypes, [contactTypeName]),
    lead_source_id: pickOptionId(options.leadSources, [leadSourceName]),
    lead_status_id: pickOptionId(options.leadStatuses, ["New"]),
    lead_type_id: pickOptionId(options.leadTypes, ["Demo"]),
    refered_by: extractFieldByLabel(text, ["referred by", "referrer", "referral"]),
    campaign: extractFieldByLabel(text, ["campaign", "source", "channel"]),
    assigned_to: options.assignedTo ?? "",
    assigned_account: matchAccountId(company, options.accounts),
    status: true,
    ...dob,
    ...social,
  };
}
