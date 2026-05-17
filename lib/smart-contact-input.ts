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

const EMAIL_WITH_DOMAIN_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

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

const INDIA_PIN_TO_LOCATION: Record<string, { city: string; state: string }> = {
  "452001": { city: "Indore", state: "Madhya Pradesh" },
  "452010": { city: "Indore", state: "Madhya Pradesh" },
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
  "805": "California",
  "818": "California",
};

const INDIA_STATE_BY_ABBR: Record<string, string> = {
  DL: "Delhi",
  GJ: "Gujarat",
  KA: "Karnataka",
  MH: "Maharashtra",
  MP: "Madhya Pradesh",
  RJ: "Rajasthan",
  TG: "Telangana",
  TS: "Telangana",
  TN: "Tamil Nadu",
  UP: "Uttar Pradesh",
  WB: "West Bengal",
};

const CITY_ALIASES: Record<string, { city: string; state: string; country: string }> = {
  addison: { city: "Addison", state: "Texas", country: "United States" },
  bangalore: { city: "Bangalore", state: "Karnataka", country: "India" },
  banglore: { city: "Bangalore", state: "Karnataka", country: "India" },
  bhopal: { city: "Bhopal", state: "Madhya Pradesh", country: "India" },
  dallas: { city: "Dallas", state: "Texas", country: "United States" },
  dallastexas: { city: "Dallas", state: "Texas", country: "United States" },
  dalls: { city: "Dallas", state: "Texas", country: "United States" },
  delhi: { city: "Delhi", state: "Delhi", country: "India" },
  houston: { city: "Houston", state: "Texas", country: "United States" },
  hosuton: { city: "Houston", state: "Texas", country: "United States" },
  hyd: { city: "Hyderabad", state: "Telangana", country: "India" },
  hyderabad: { city: "Hyderabad", state: "Telangana", country: "India" },
  indore: { city: "Indore", state: "Madhya Pradesh", country: "India" },
  jaipur: { city: "Jaipur", state: "Rajasthan", country: "India" },
  khandwa: { city: "Khandwa", state: "Madhya Pradesh", country: "India" },
  "los angeles": { city: "Los Angeles", state: "California", country: "United States" },
  mumbai: { city: "Mumbai", state: "Maharashtra", country: "India" },
  newyork: { city: "New York", state: "New York", country: "United States" },
  "new york": { city: "New York", state: "New York", country: "United States" },
  noida: { city: "Noida", state: "Uttar Pradesh", country: "India" },
  pune: { city: "Pune", state: "Maharashtra", country: "India" },
};

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
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

function normalizeUnicode(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, " ")
    .replace(/[Øø]/g, "o");
}

function cleanValue(value: string) {
  return normalizeWhitespace(
    normalizeUnicode(value)
      .replace(/\u00a0/g, " ")
      .replace(/[<>]/g, " ")
  );
}

function normalizeNumberWords(value: string) {
  return value.replace(/\b(zero|oh|o|one|two|three|four|five|six|seven|eight|nine)\b/gi, (word) => {
    return NUMBER_WORDS[word.toLowerCase()] ?? word;
  });
}

function normalizeMixedNumberWords(value: string) {
  let next = value;
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    next = next.replace(new RegExp(word, "gi"), digit);
  }
  return next;
}

function repairEmailText(text: string) {
  return normalizeWhitespace(
    text
      .replace(/\b(?:\(|\[)?at(?:\)|\])?\b/gi, "@")
      .replace(/\b(?:\(|\[)?dot(?:\)|\])?\b/gi, ".")
      .replace(/\s+@\s+/g, "@")
      .replace(/@+/g, "@")
      .replace(/\s*\.\s*/g, ".")
      .replace(/,+/g, ".")
  );
}

function normalizeEmailCandidate(value: string) {
  let candidate = value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,+/g, ".")
    .replace(/@+/g, "@")
    .replace(/\.{2,}/g, ".")
    .replace(/@([a-z0-9-]+)com$/i, "@$1.com")
    .replace(/@([a-z0-9-]+)co$/i, "@$1.co")
    .replace(/@([a-z0-9-]+)in$/i, "@$1.in")
    .replace(/\.$/, "");

  if (/^[a-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud|aol)com$/i.test(candidate)) {
    candidate = candidate.replace(/@(gmail|yahoo|outlook|hotmail|icloud|aol)com$/i, "@$1.com");
  }

  return EMAIL_WITH_DOMAIN_PATTERN.test(candidate)
    ? candidate
    : "";
}

function extractEmail(text: string) {
  const repaired = repairEmailText(text);
  const direct = repaired.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+(?:\.[a-z]{2,}|com|co|in)\b/i);
  if (direct) {
    const normalized = normalizeEmailCandidate(direct[0]);
    if (normalized) return normalized;
  }

  const hasExplicitEmailMarker = /@|\b(?:at|dot)\b/i.test(text);
  const spaced = hasExplicitEmailMarker
    ? repaired.match(/\b([a-zA-Z0-9._%+-]+)\s+([a-zA-Z0-9-]+)\s+([a-z]{2,})\b/i)
    : null;
  if (spaced) {
    return normalizeEmailCandidate(`${spaced[1]}@${spaced[2]}.${spaced[3]}`);
  }

  const reversed = hasExplicitEmailMarker
    ? repaired.match(/\b([a-zA-Z0-9-]+\.[a-z]{2,})\s+([a-zA-Z0-9._%+-]+)\b/i)
    : null;
  if (reversed) {
    return normalizeEmailCandidate(`${reversed[2]}@${reversed[1]}`);
  }

  const domainOnly = hasExplicitEmailMarker
    ? repaired.match(/\b([a-zA-Z0-9._%+-]+)\s*([a-zA-Z0-9-]+\.[a-z]{2,})\b/i)
    : null;
  if (domainOnly) {
    return normalizeEmailCandidate(`${domainOnly[1]}@${domainOnly[2]}`);
  }

  return "";
}

function hasIndiaContext(text: string) {
  return /\b(india|indore|khandwa|bhopal|jaipur|rajasthan|madhya|maharashtra|maharastra|mumbai|pune|noida|delhi|telangana|hyderabad|bangalore|banglore|\+91|mp|mh|rj|up|gst|lakh|cr|crore)\b/i.test(text);
}

function hasUsContext(text: string) {
  return /\b(usa|us|dallas|houston|texas|tx|new york|newyork|los angeles|ca|policy|medicare|500k|250k)\b/i.test(text);
}

function normalizePhone(raw: string, context = "") {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 11 && digits.startsWith("1")) {
    return `+${digits.slice(0, 11)}`;
  }
  if (digits.length > 10 && digits.startsWith("91")) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.length > 10 && hasUsContext(context)) {
    return `+1${digits.slice(0, 10)}`;
  }
  if (digits.length > 10 && hasIndiaContext(context)) {
    return `+91${digits.slice(-10)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    const trimmed = digits.slice(1);
    return hasIndiaContext(context) ? `+91${trimmed}` : `+1${trimmed}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    if (hasIndiaContext(context) || /^[6-9]/.test(digits)) {
      return `+91${digits}`;
    }
    return `+1${digits}`;
  }
  if (raw.trim().startsWith("+")) {
    return `+${digits}`;
  }
  return digits;
}

function extractPhones(text: string) {
  const normalized = normalizeMixedNumberWords(normalizeNumberWords(text));
  const candidates = [
    ...(normalized.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) ?? []),
    ...(normalized.match(/\b[a-z]{2}\d{10,12}\b/gi) ?? []),
  ];
  return Array.from(
    new Set(candidates.map((candidate) => normalizePhone(candidate, text)).filter(Boolean)),
  );
}

function extractZip(text: string) {
  return text.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? "";
}

function extractDOB(text: string) {
  const match = text.match(/\b(?:dob\s*)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/i);
  if (!match) return {};

  const value = match[1];
  const parts = value.includes("-") ? value.split("-") : value.split("/");
  if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return {
      birthday_year: parts[0],
      birthday_month: String(Number(parts[1])),
      birthday_day: String(Number(parts[2])),
    };
  }

  return {
    birthday_year: parts[2].length === 2 ? String(Number(parts[2]) > 30 ? 1900 + Number(parts[2]) : 2000 + Number(parts[2])) : parts[2],
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

  const lower = text.toLowerCase();
  const explicitDomain = text.match(/\b([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|io|co|in|net|org))\b/i)?.[1];
  if (explicitDomain && !GENERIC_EMAIL_DOMAINS.has(explicitDomain.toLowerCase())) {
    return titleCase(explicitDomain.split(".")[0].replace(/[-_]/g, " "));
  }

  const ceoMatch = lower.match(/\b(?:ceo|founder|owner)\s+([a-z][a-z0-9\s.-]{2,50})(?:\s+(?:dallas|houston|indore|delhi|tx|mp|phone|need|budget)|$)/i);
  if (ceoMatch?.[1]) return titleCase(ceoMatch[1].replace(/\b(finacial)\b/i, "financial"));

  const companyMatch = lower.match(/\b([a-z][a-z0-9\s.-]{2,50})\s+(?:private limited|pvt ltd|llc|inc|financial|capital|cap|office|agency)\b/i);
  if (companyMatch?.[0]) return titleCase(companyMatch[0].replace(/\bfinacial\b/i, "financial"));

  const worksAt = lower.match(/\bworks\s+@\s*([a-z][a-z0-9\s.-]{2,40})/i);
  if (worksAt?.[1]) return titleCase(worksAt[1]);

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

  const leadingSegment = text
    .split(/\b(?:need|call|quote|budget|policy|coverage|crm|demo)\b|@|\+?\d/i)[0]
    .replace(/\b(?:from|near|opp|opposite)\b.*$/i, " ")
    .replace(/\b(?:dallas|houston|texas|tx|indore|mp|madhya|pradesh|khandwa|jaipur|rajasthan|delhi|noida|pune|mumbai|new|york|los|angeles|usa|hyd|telangana|banglore|bangalore)\b/gi, " ");
  const leadingParts = leadingSegment
    .split(/\s+/)
    .filter((part) => /^[a-zA-Z]+$/.test(part));
  if (leadingParts.length >= 2) {
    return {
      first_name: titleCase(leadingParts.slice(0, -1).join(" ")),
      last_name: titleCase(leadingParts.at(-1) ?? ""),
    };
  }
  if (leadingParts.length === 1) {
    return {
      first_name: "",
      last_name: titleCase(leadingParts[0]),
    };
  }

  const emailFreeText = email ? repairEmailText(text).replace(email, " ") : text;
  const beforeEmail = email ? emailFreeText.split("@")[0] : emailFreeText;
  const candidate = beforeEmail
    .split(/[\n|,;/]/)
    .map((part) => cleanValue(part))
    .filter(Boolean)
    .pop() ?? "";

  const emailLocalPart = email.split("@")[0]?.split(/[._-]+/)[0]?.toLowerCase() ?? "";
  const candidateParts = candidate
    .replace(/\b(?:near|opp|opposite)\b.*$/i, " ")
    .replace(/\b(?:need|call|quote|budget|policy|coverage|crm|demo|from|at|near|ceo|founder|owner|smoker|diabetic|age\d+|age)\b/gi, " ")
    .replace(/\b(?:dallas|houston|texas|tx|indore|mp|madhya|pradesh|jaipur|rajasthan|delhi|noida|pune|mumbai|new|york|los|angeles|usa)\b/gi, " ")
    .replace(/\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi, " ")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, " ")
    .split(/\s+/)
    .filter((part) => /^[a-zA-Z]+$/.test(part))
    .filter((part) => part.toLowerCase() !== emailLocalPart);
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
  if (/(referral|referred|agent|agnt|broker|brokr|license|downline|insurance office|agency)/i.test(normalized)) {
    return "Agent";
  }
  if (/(vendor|vender|supplier|printing|printng)/i.test(normalized)) {
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
  if (/(facebook|fb|meta ads|fb ads|facebook comments)/i.test(normalized)) return "Facebook";
  if (/(linkedin|lnkdin)/i.test(normalized)) return "LinkedIn";
  if (/(instagram|insta)/i.test(normalized)) return "Instagram";
  if (/(tiktok)/i.test(normalized)) return "TikTok";
  if (/(website|web form|website form)/i.test(normalized)) return "Website";
  if (/(linkedin\.com|facebook\.com|twitter\.com|x\.com)/i.test(normalized)) return "Web";
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
        country: "United States",
      };
    }
    const indianLocation = INDIA_PIN_TO_LOCATION[zip];
    if (indianLocation) {
      return {
        city: indianLocation.city,
        state: indianLocation.state,
        postal_code: zip,
        country: "India",
      };
    }
  }

  const cityMatch = extractFieldByLabel(text, ["city", "town"]);
  const stateMatch = extractFieldByLabel(text, ["state"]);
  const areaCode = phone.replace(/\D/g, "").slice(-10).slice(0, 3);
  const mappedState = AREA_CODE_TO_STATE[areaCode];
  const lower = text.toLowerCase().replace(/[^\w\s]/g, " ");

  const cityAlias = Object.entries(CITY_ALIASES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([alias]) => new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower));

  const rawExplicitState =
    (lower.match(/\b([a-z]{2})\b/g) ?? [])
      .map((token) => token.trim().toUpperCase())
      .map((abbr) => STATE_BY_ABBR[abbr] ?? INDIA_STATE_BY_ABBR[abbr])
      .find(Boolean) ?? "";
  const explicitState =
    rawExplicitState && (hasUsContext(text) || hasIndiaContext(text) || cityAlias)
      ? rawExplicitState
      : "";

  const city = cityMatch ? titleCase(cityMatch) : cityAlias?.[1].city ?? "";
  const stateFromCity = cityAlias?.[1].state ?? "";

  const state = stateMatch
    ? STATE_BY_ABBR[stateMatch.toUpperCase()] ?? INDIA_STATE_BY_ABBR[stateMatch.toUpperCase()] ?? titleCase(stateMatch)
    : explicitState || mappedState || stateFromCity;

  return {
    city,
    state,
    postal_code: "",
    country: cityAlias?.[1].country ?? (hasIndiaContext(text) ? "India" : "United States"),
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

function inferHandle(text: string) {
  const handle = text.match(/(^|\s)@([A-Za-z0-9._-]{3,})\b/)?.[2] ?? "";
  if (!handle) return {};

  if (/wealth|builder|tx|outreach/i.test(handle)) {
    return { social_instagram: `@${handle}` };
  }

  return { social_twitter: `@${handle}` };
}

function inferAddress(text: string, city: string, state: string) {
  const explicit = extractFieldByLabel(text, ["address", "street"]);
  if (explicit) return explicit;

  const addressMatch = text.match(
    /\b((?:flat|house|plot|apt|apartment|suite|sec|sector|no)\s+[^,|;\n]{3,90}|near\s+[^,|;\n]{3,80}|opp\s+[^,|;\n]{3,80})/i,
  )?.[1];

  if (!addressMatch) return "";

  return titleCase(
    addressMatch
      .replace(new RegExp(`\\b${city}\\b`, "i"), "")
      .replace(new RegExp(`\\b${state}\\b`, "i"), "")
      .trim(),
  );
}

function extractReferral(text: string) {
  return (
    text.match(/\b(?:referred by|referral from|call from)\s+([a-z][a-z\s]{1,40})/i)?.[1] ??
    ""
  );
}

function extractAge(text: string) {
  return text.match(/\bage\s*[:\-]?\s*(\d{1,3})\b/i)?.[1] ?? text.match(/\bage(\d{1,3})\b/i)?.[1] ?? "";
}

function extractBudget(text: string) {
  const lower = text.toLowerCase();
  const explicitCurrency = lower.match(/\$\s*([\d,]+(?:\.\d+)?)/)?.[1];
  if (explicitCurrency) return explicitCurrency.replace(/,/g, "");

  const amount = lower.match(/\b(\d+(?:\.\d+)?)\s*(lakh|lac|grand|k|m|million|cr|crore)\b/) ??
    lower.match(/\bbudget\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(lakh|lac|grand|k|m|million|cr|crore)?\b/) ??
    lower.match(/\bbudget\s*[:\-]?\s*(\d+(?:\.\d+)?)\b/) ??
    lower.match(/\b(\d+(?:\.\d+)?)\s*(?:monthly|setup|budget)\b/);

  if (!amount) return "";

  const value = Number(amount[1]);
  const unit = amount[2] ?? "";

  if (!Number.isFinite(value)) return "";
  if (unit === "lakh" || unit === "lac") return String(Math.round(value * 100000));
  if (unit === "cr" || unit === "crore") return String(Math.round(value * 10000000));
  if (unit === "grand" || unit === "k") return String(Math.round(value * 1000));
  if (unit === "m" || unit === "million") return String(Math.round(value * 1000000));
  return String(value);
}

function extractCoverage(text: string) {
  const lower = text.toLowerCase();
  const match = lower.match(/\b(\d+(?:\.\d+)?)\s*(k|m|million|cr|crore)?\s*(?:coverage|covrage|policy|face amount)?\b/);
  if (!match) return "";

  const hasCoverageContext = /(coverage|covrage|policy|insurance|insurence|life|term|iul|final expense|annuity)/i.test(lower);
  if (!hasCoverageContext) return "";

  const value = Number(match[1]);
  const unit = match[2] ?? "";
  if (!Number.isFinite(value)) return "";
  if (unit === "k") return String(Math.round(value * 1000));
  if (unit === "m" || unit === "million") return String(Math.round(value * 1000000));
  if (unit === "cr" || unit === "crore") return String(Math.round(value * 10000000));
  return String(value);
}

function inferProducts(text: string) {
  const normalized = text.toLowerCase();
  const products: string[] = [];

  const add = (value: string) => {
    if (!products.includes(value)) products.push(value);
  };

  if (/(life|term|iul|insurance|insurence|polcy|policy|coverage|covrage|final expense)/i.test(normalized)) add("Life Insurance");
  if (/(medicare|medcare|supplement|supplment)/i.test(normalized)) add("Medicare");
  if (/(annuity|annuity plan)/i.test(normalized)) add("Annuity");
  if (/(aca|dental)/i.test(normalized)) add("ACA/Dental");
  if (/(crm|software|saas|custom crm|audit logs|role permissions)/i.test(normalized)) add("CRM Software");
  if (/(ai caller|automation|whatsapp|meta ads|linkedin outreach|sender|api)/i.test(normalized)) add("Automation");
  if (/(dairy|milk collection|society)/i.test(normalized)) add("Dairy Software");
  if (/(cheque|printing|gst billing|billing)/i.test(normalized)) add("Billing Software");
  if (/(hospital|lab|healthcare)/i.test(normalized)) add("Healthcare CRM");
  if (/(service software|technician|amc)/i.test(normalized)) add("Service Management");
  if (/(real estate)/i.test(normalized)) add("Real Estate CRM");

  return products;
}

function inferIntent(text: string) {
  const lower = text.toLowerCase();
  const intents: string[] = [];
  if (/(quote|coverage|policy|insurance|medicare|annuity)/i.test(lower)) intents.push("Insurance inquiry");
  if (/(demo|onboarding|crm|software|automation|ai caller|whatsapp|meta ads|linkedin outreach)/i.test(lower)) intents.push("B2B opportunity");
  if (/(call|followup|follow up|meeting|tomrw|tomorrow|next monday|next tue|friday|after 5pm|3pm|evening)/i.test(lower)) intents.push("Follow-up task");
  return intents.join(", ");
}

function inferNextStep(text: string) {
  const lower = text.toLowerCase();
  if (/(demo|meeting)/i.test(lower)) return "Schedule demo";
  if (/(call|tomrw|tomorrow|after 5pm|evening|3pm|followup|follow up)/i.test(lower)) return "Call lead";
  if (/(quote|policy|coverage)/i.test(lower)) return "Prepare quote";
  return "";
}

function extractTeamSize(text: string) {
  return (
    text.match(/\b(\d+)\s*(?:agents|agnts|users|branches)\b/i)?.[0] ??
    text.match(/\bagency with\s+(\d+)\s+agents\b/i)?.[0] ??
    ""
  );
}

export function extractOpportunitySignals(input: string) {
  const text = cleanValue(input);
  const products = inferProducts(text);
  const budget = extractBudget(text) || extractCoverage(text);
  const intent = inferIntent(text);
  const nextStep = inferNextStep(text);
  const teamSize = extractTeamSize(text);
  const currency = hasIndiaContext(text) ? "INR" : "";

  return {
    products,
    budget,
    currency,
    intent,
    nextStep,
    teamSize,
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
  const social = { ...inferSocialLinks(text), ...inferHandle(text) };
  const dob = extractDOB(text);
  const age = extractAge(text);
  const referral = extractReferral(text);
  const addressLine1 = inferAddress(text, location.city, location.state);
  const opportunitySignals = extractOpportunitySignals(text);
  const descriptionParts = [
    text,
    opportunitySignals.intent ? `Intent: ${opportunitySignals.intent}` : "",
    opportunitySignals.products.length ? `Products: ${opportunitySignals.products.join(", ")}` : "",
    opportunitySignals.budget ? `Budget/Coverage: ${opportunitySignals.budget}` : "",
    opportunitySignals.teamSize ? `Team size: ${opportunitySignals.teamSize}` : "",
    age ? `Age: ${age}` : "",
    /\bsmoker\b/i.test(text) ? "Risk: smoker" : "",
    /\bdiabetic\b/i.test(text) ? "Risk: diabetic" : "",
    /\b(?:wife|kids|mom|family|married|single)\b/i.test(text) ? "Family/relationship details present" : "",
  ].filter(Boolean);
  const description = descriptionParts.join("\n").slice(0, 1000);

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
    address: addressLine1,
    address_line1: addressLine1 || extractFieldByLabel(text, ["address", "address line 1", "address1", "street"]),
    address_line2: extractFieldByLabel(text, ["address line 2", "address2", "suite", "apt", "apartment"]),
    city: location.city,
    state: location.state,
    country: location.country,
    postal_code: location.postal_code,
    position: extractFieldByLabel(text, ["position", "title", "job title"]) || (/\bceo\b/i.test(text) ? "CEO" : ""),
    jobTitle: extractFieldByLabel(text, ["job title", "title", "position"]) || (/\bceo\b/i.test(text) ? "CEO" : ""),
    role,
    contact_type_id: pickOptionId(options.contactTypes, [contactTypeName]),
    lead_source_id: pickOptionId(options.leadSources, [leadSourceName]),
    lead_status_id: pickOptionId(options.leadStatuses, ["New"]),
    lead_type_id: pickOptionId(options.leadTypes, ["Inbound", "Demo"]),
    refered_by: referral || extractFieldByLabel(text, ["referred by", "referrer", "referral"]),
    campaign: extractFieldByLabel(text, ["campaign", "source", "channel"]) || leadSourceName,
    assigned_to: options.assignedTo ?? "",
    assigned_account: matchAccountId(company, options.accounts),
    status: true,
    ...dob,
    ...social,
  };
}
