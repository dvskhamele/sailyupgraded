import OpenAI from "openai";
import FirecrawlApp from "@mendable/firecrawl-js";
import { sanitizeApiKey, maskApiKey } from "@/lib/api-keys";

export interface PersonEnrichmentInput {
  id?: string;
  externalId?: string;
  email?: string | null;
  personal_email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  office_phone?: string | null;
  company?: string | null;
  website?: string | null;
  linkedin?: string | null;
  jobTitle?: string | null;
  position?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  notes?: unknown;
  custom_fields_data?: unknown;
}

export interface EnrichedPersonData {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  office_phone?: string | null;
  job_title?: string | null;
  position?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  skype?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  company_name?: string | null;
  company_website?: string | null;
  industry?: string | null;
  location?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  company_size?: string | null;
  description?: string | null;
  other_info?: Record<string, unknown> | null;
  external_account_id?: string | null;
}

export interface EnrichedCompanyData {
  id?: string | null;
  name?: string | null;
  website?: string | null;
  domain?: string | null;
  industry?: string | null;
  employeeCount?: string | null;
  revenue?: string | null;
  linkedin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface EnrichedDataResult {
  success: boolean;
  personFound: boolean;
  companyFound: boolean;
  person: EnrichedPersonData | null;
  company: EnrichedCompanyData | null;
  source?: "external_api" | "ai_provider" | "heuristics";
}

export function isValidString(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower === "n/a" ||
    lower === "none" ||
    lower === "unknown" ||
    lower === "unavailable"
  ) {
    return false;
  }
  return true;
}

export function sanitizeCleanString(val: unknown): string | null {
  if (!isValidString(val)) return null;
  let str = val.trim();
  // Remove wrapping brackets or quotes from stringified arrays like "['value']" or "['id']"
  if (str.startsWith("['") && str.endsWith("']")) {
    str = str.slice(2, -2).trim();
  } else if (str.startsWith('["') && str.endsWith('"]')) {
    str = str.slice(2, -2).trim();
  } else if (str.startsWith("[") && str.endsWith("]")) {
    str = str.slice(1, -1).trim();
  }
  return isValidString(str) ? str : null;
}

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
]);

export function parseEmailInfo(email: string | null | undefined): {
  domain: string | null;
  companyGuess: string | null;
  isPersonal: boolean;
  firstNameGuess: string | null;
  lastNameGuess: string | null;
} {
  const cleanEmail = sanitizeCleanString(email);
  if (!cleanEmail) {
    return {
      domain: null,
      companyGuess: null,
      isPersonal: false,
      firstNameGuess: null,
      lastNameGuess: null,
    };
  }

  const parts = cleanEmail.toLowerCase().split("@");
  if (parts.length !== 2) {
    return {
      domain: null,
      companyGuess: null,
      isPersonal: false,
      firstNameGuess: null,
      lastNameGuess: null,
    };
  }

  const localPart = parts[0];
  const domain = parts[1];
  const isPersonal = PERSONAL_DOMAINS.has(domain);

  let firstNameGuess: string | null = null;
  let lastNameGuess: string | null = null;
  const nameParts = localPart.split(/[._-]/).filter(Boolean);
  if (nameParts.length >= 2) {
    firstNameGuess =
      nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
    lastNameGuess =
      nameParts[nameParts.length - 1].charAt(0).toUpperCase() +
      nameParts[nameParts.length - 1].slice(1);
  } else if (nameParts.length === 1) {
    firstNameGuess =
      nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
  }

  let companyGuess: string | null = null;
  if (!isPersonal && domain) {
    const domainName = domain.split(".")[0];
    if (domainName) {
      companyGuess = domainName.charAt(0).toUpperCase() + domainName.slice(1);
    }
  }

  return {
    domain,
    companyGuess,
    isPersonal,
    firstNameGuess,
    lastNameGuess,
  };
}

const EXTERNAL_ENRICHMENT_BASE_URL =
  process.env.ENRICHMENT_API_URL || "http://129.146.163.220:7149";

const REQUEST_TIMEOUT_MS = 5000;

async function safeFetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    return null;
  }
}

/**
 * Searches external person endpoint:
 * http://129.146.163.220:7149/contacts
 *
 * Matching priority:
 * 1. External ID if available (/contact/{contact_id})
 * 2. Email
 * 3. LinkedIn URL
 * 4. Phone
 * 5. First Name + Last Name + Company
 * 6. First Name + Last Name
 */
export async function searchExternalPerson(
  input: PersonEnrichmentInput
): Promise<EnrichedPersonData | null> {
  const baseUrl = EXTERNAL_ENRICHMENT_BASE_URL.replace(/\/+$/, "");

  // 1. External ID
  if (isValidString(input.externalId)) {
    try {
      const res = await safeFetchWithTimeout(
        `${baseUrl}/contact/${encodeURIComponent(input.externalId.trim())}`
      );
      if (res && res.ok) {
        const item = await res.json();
        if (item && typeof item === "object") {
          return mapExternalPersonRecord(item);
        }
      }
    } catch {
      // Continue to next priority
    }
  }

  // Build list of query candidate strings based on matching priority
  const queryCandidates: Array<{ query: string; type: string }> = [];

  const email = sanitizeCleanString(input.email || input.personal_email);
  if (email && email.includes("@")) {
    queryCandidates.push({ query: email, type: "email" });
  }

  const linkedin = sanitizeCleanString(input.linkedin);
  if (linkedin) {
    queryCandidates.push({ query: linkedin, type: "linkedin" });
  }

  const phone = sanitizeCleanString(input.phone || input.mobile_phone || input.office_phone);
  if (phone && phone.length >= 6) {
    queryCandidates.push({ query: phone, type: "phone" });
  }

  const firstName = sanitizeCleanString(input.firstName);
  const lastName = sanitizeCleanString(input.lastName);
  const company = sanitizeCleanString(input.company);

  if (firstName && lastName && company) {
    queryCandidates.push({ query: `${firstName} ${lastName} ${company}`, type: "name_company" });
  }

  if (firstName && lastName) {
    queryCandidates.push({ query: `${firstName} ${lastName}`, type: "name" });
  } else if (isValidString(input.fullName)) {
    queryCandidates.push({ query: input.fullName.trim(), type: "name" });
  }

  // Execute search queries in priority order
  for (const candidate of queryCandidates) {
    try {
      const res = await safeFetchWithTimeout(
        `${baseUrl}/contacts/search?q=${encodeURIComponent(candidate.query)}`
      );
      if (!res || !res.ok) continue;

      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) continue;

      const bestMatch = findBestPersonMatch(results, input, candidate.type);
      if (bestMatch) {
        return mapExternalPersonRecord(bestMatch);
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

function findBestPersonMatch(
  results: any[],
  input: PersonEnrichmentInput,
  matchType: string
): any | null {
  if (results.length === 1) return results[0];

  const inputEmail = sanitizeCleanString(input.email || input.personal_email)?.toLowerCase();
  const inputFirst = sanitizeCleanString(input.firstName)?.toLowerCase();
  const inputLast = sanitizeCleanString(input.lastName)?.toLowerCase();

  for (const r of results) {
    const resEmail = sanitizeCleanString(r.email || r.personal_email)?.toLowerCase();
    if (inputEmail && resEmail && (resEmail === inputEmail || resEmail.includes(inputEmail))) {
      return r;
    }
    const resFirst = sanitizeCleanString(r.first_name)?.toLowerCase();
    const resLast = sanitizeCleanString(r.last_name)?.toLowerCase();
    if (inputFirst && inputLast && resFirst === inputFirst && resLast === inputLast) {
      return r;
    }
  }

  return results[0];
}

function mapExternalPersonRecord(rec: any): EnrichedPersonData {
  const rawAccountIds = sanitizeCleanString(rec.accountsIDs || rec.account);

  return {
    first_name: sanitizeCleanString(rec.first_name),
    last_name: sanitizeCleanString(rec.last_name),
    full_name:
      sanitizeCleanString(rec.person_name) ||
      `${sanitizeCleanString(rec.first_name) || ""} ${sanitizeCleanString(rec.last_name) || ""}`.trim() ||
      null,
    email: sanitizeCleanString(rec.email),
    personal_email: sanitizeCleanString(rec.personal_email),
    phone: sanitizeCleanString(rec.phone || rec.person_sanitized_phone),
    office_phone: sanitizeCleanString(rec.office_phone),
    mobile_phone: sanitizeCleanString(rec.mobile_phone),
    job_title: sanitizeCleanString(rec.jobTitle || rec.person_title_normalized || rec.primary_title_normalized_for_faceting),
    position: sanitizeCleanString(rec.position || rec.jobTitle),
    linkedin_url: sanitizeCleanString(rec.social_linkedin),
    twitter_url: sanitizeCleanString(rec.social_twitter),
    facebook_url: sanitizeCleanString(rec.social_facebook),
    instagram_url: sanitizeCleanString(rec.social_instagram),
    skype: sanitizeCleanString(rec.social_skype),
    youtube: sanitizeCleanString(rec.social_youtube),
    tiktok: sanitizeCleanString(rec.social_tiktok),
    company_name: sanitizeCleanString(rec.company),
    company_website: sanitizeCleanString(rec.website),
    industry: sanitizeCleanString(rec.industry || rec.person_detailed_function || rec.person_functions),
    location: sanitizeCleanString(rec.city ? `${rec.city}, ${rec.country || ""}` : rec.country),
    address: sanitizeCleanString(rec.address || rec.address_line1),
    address_line1: sanitizeCleanString(rec.address_line1 || rec.address),
    address_line2: sanitizeCleanString(rec.address_line2),
    city: sanitizeCleanString(rec.city),
    state: sanitizeCleanString(rec.state),
    country: sanitizeCleanString(rec.country),
    postal_code: sanitizeCleanString(rec.postal_code || rec.post_code),
    company_size: sanitizeCleanString(rec.company_size),
    description: sanitizeCleanString(rec.description),
    external_account_id: rawAccountIds,
  };
}

/**
 * Searches external account endpoint:
 * http://129.146.163.220:7149/accounts
 */
export async function searchExternalAccount(
  companyNameOrId: string
): Promise<EnrichedCompanyData | null> {
  const query = sanitizeCleanString(companyNameOrId);
  if (!query) return null;

  const baseUrl = EXTERNAL_ENRICHMENT_BASE_URL.replace(/\/+$/, "");

  try {
    const res = await safeFetchWithTimeout(
      `${baseUrl}/accounts/search?q=${encodeURIComponent(query)}`
    );
    if (res && res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const item = results[0];
        return {
          id: sanitizeCleanString(item.id),
          name: sanitizeCleanString(item.name || query),
          website: sanitizeCleanString(item.website),
          industry: sanitizeCleanString(item.industry),
          description: sanitizeCleanString(item.description),
          city: sanitizeCleanString(item.billing_city || item.city),
          state: sanitizeCleanString(item.billing_state || item.state),
          country: sanitizeCleanString(item.billing_country || item.country),
          postal_code: sanitizeCleanString(item.billing_postal_code || item.postal_code),
          address: sanitizeCleanString(item.billing_street || item.address),
          phone: sanitizeCleanString(item.office_phone || item.phone),
          email: sanitizeCleanString(item.email),
        };
      }
    }
  } catch {
    // Search failed or timed out
  }

  // Return base company structure if search didn't yield extra details
  return {
    name: query,
  };
}

/**
 * AI & Web Search Fallback Provider (OpenAI & Firecrawl)
 */
async function fetchEnrichmentFromAIProvider(
  input: PersonEnrichmentInput,
  keys: {
    openaiApiKey?: string | null;
    openaiApiKeys?: string[];
    firecrawlApiKey?: string | null;
  }
): Promise<EnrichedPersonData> {
  const email = sanitizeCleanString(input.email || input.personal_email);
  const fullName =
    sanitizeCleanString(input.fullName) ||
    `${sanitizeCleanString(input.firstName) || ""} ${sanitizeCleanString(input.lastName) || ""}`.trim();
  const company = sanitizeCleanString(input.company);
  const website = sanitizeCleanString(input.website);
  const position = sanitizeCleanString(input.position || input.jobTitle);

  const emailInfo = parseEmailInfo(email);
  let scrapedContent = "";

  const firecrawlKey = sanitizeApiKey(keys.firecrawlApiKey);
  if (firecrawlKey) {
    try {
      const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });
      const searchQueries: string[] = [];

      if (email && !emailInfo.isPersonal && emailInfo.domain) {
        searchQueries.push(`site:${emailInfo.domain} OR "${email}"`);
      }
      if (fullName && company) {
        searchQueries.push(`"${fullName}" "${company}" LinkedIn`);
      } else if (fullName && email) {
        searchQueries.push(`"${fullName}" "${email}"`);
      } else if (company) {
        searchQueries.push(`"${company}" company about overview`);
      }

      for (const query of searchQueries.slice(0, 2)) {
        try {
          const searchRes = await firecrawl.search(query, {
            limit: 2,
            scrapeOptions: { formats: ["markdown"] },
          });

          if (searchRes.data && Array.isArray(searchRes.data)) {
            for (const item of searchRes.data) {
              if (item.markdown) {
                scrapedContent += `\nSource: ${item.url || query}\n${item.markdown.slice(0, 3000)}\n---`;
              } else if (item.description) {
                scrapedContent += `\nSource: ${item.url || query}\n${item.description}\n---`;
              }
            }
          }
        } catch (e) {
          console.warn(`[ExternalEnrichment] Firecrawl search query '${query}' failed:`, e);
        }
      }
    } catch (err) {
      console.warn("[ExternalEnrichment] Firecrawl initialization or search failed:", err);
    }
  }

  const openaiCandidateKeys =
    Array.isArray(keys.openaiApiKeys) && keys.openaiApiKeys.length > 0
      ? keys.openaiApiKeys
      : keys.openaiApiKey
      ? [keys.openaiApiKey]
      : [];

  for (const rawKey of openaiCandidateKeys) {
    const sanitizedKey = sanitizeApiKey(rawKey);
    if (!sanitizedKey) continue;

    try {
      const openai = new OpenAI({ apiKey: sanitizedKey });

      const prompt = `You are a B2B contact and company data enrichment assistant.
Given the following person information and scraped web content, enrich and extract all available valid data for this person and their company.

Person known data:
- Full Name: ${fullName || "Unknown"}
- First Name: ${input.firstName || "Unknown"}
- Last Name: ${input.lastName || "Unknown"}
- Email: ${email || "Unknown"}
- Company: ${company || "Unknown"}
- Website: ${website || "Unknown"}
- Title/Position: ${position || "Unknown"}
- Phone: ${input.phone || input.mobile_phone || input.office_phone || "Unknown"}
- LinkedIn: ${input.linkedin || "Unknown"}
- Address/Location: ${input.city || input.address || input.country || "Unknown"}

${scrapedContent ? `Scraped Web Context:\n${scrapedContent.slice(0, 8000)}` : ""}

Return a strictly valid JSON object matching this schema:
{
  "first_name": string | null,
  "last_name": string | null,
  "full_name": string | null,
  "email": string | null,
  "phone": string | null,
  "mobile_phone": string | null,
  "office_phone": string | null,
  "job_title": string | null,
  "linkedin_url": string | null,
  "twitter_url": string | null,
  "facebook_url": string | null,
  "instagram_url": string | null,
  "company_name": string | null,
  "company_website": string | null,
  "industry": string | null,
  "location": string | null,
  "city": string | null,
  "state": string | null,
  "country": string | null,
  "postal_code": string | null,
  "company_size": string | null,
  "description": string | null
}

Instructions:
- If a field is not found with reasonable confidence, set it to null.
- Do NOT guess or hallucinate phone numbers or private emails.
- Ensure website URLs have https:// prefix.
- If corporate email domain indicates company name or website, provide them.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content) as EnrichedPersonData;
      }
    } catch (err: any) {
      console.warn("[ExternalEnrichment] OpenAI enrichment failed:", err?.message || err);
    }
  }

  // Heuristics fallback
  const fallbackResult: EnrichedPersonData = {};
  if (emailInfo.firstNameGuess && !isValidString(input.firstName)) {
    fallbackResult.first_name = emailInfo.firstNameGuess;
  }
  if (emailInfo.lastNameGuess && !isValidString(input.lastName)) {
    fallbackResult.last_name = emailInfo.lastNameGuess;
  }
  if (emailInfo.companyGuess && !isValidString(input.company)) {
    fallbackResult.company_name = emailInfo.companyGuess;
  }
  if (emailInfo.domain && !emailInfo.isPersonal && !isValidString(input.website)) {
    fallbackResult.company_website = `https://${emailInfo.domain}`;
  }

  return fallbackResult;
}

/**
 * Main Pure Enrichment Function
 *
 * This function fetches enriched person and company data.
 * It NEVER performs database updates.
 */
export async function enrichPersonData(
  input: PersonEnrichmentInput,
  options?: {
    keys?: {
      openaiApiKey?: string | null;
      openaiApiKeys?: string[];
      firecrawlApiKey?: string | null;
    };
  }
): Promise<EnrichedDataResult> {
  // 1. First search external microservice (http://129.146.163.220:7149/contacts)
  let personData = await searchExternalPerson(input);
  let source: "external_api" | "ai_provider" | "heuristics" = "external_api";

  // 2. If external API didn't find person, try AI provider or heuristic extraction
  if (!personData || Object.keys(personData).length === 0) {
    if (options?.keys) {
      personData = await fetchEnrichmentFromAIProvider(input, options.keys);
      source = "ai_provider";
    } else {
      const emailInfo = parseEmailInfo(input.email || input.personal_email);
      const fallback: EnrichedPersonData = {};
      if (emailInfo.firstNameGuess && !isValidString(input.firstName)) fallback.first_name = emailInfo.firstNameGuess;
      if (emailInfo.lastNameGuess && !isValidString(input.lastName)) fallback.last_name = emailInfo.lastNameGuess;
      if (emailInfo.companyGuess && !isValidString(input.company)) fallback.company_name = emailInfo.companyGuess;
      if (emailInfo.domain && !emailInfo.isPersonal && !isValidString(input.website)) fallback.company_website = `https://${emailInfo.domain}`;
      personData = Object.keys(fallback).length > 0 ? fallback : null;
      source = "heuristics";
    }
  }

  if (!personData) {
    return {
      success: false,
      personFound: false,
      companyFound: false,
      person: null,
      company: null,
    };
  }

  // 3. Check for company information
  let companyData: EnrichedCompanyData | null = null;
  const companyIdentifier =
    personData.external_account_id ||
    personData.company_name ||
    input.company ||
    personData.company_website ||
    input.website;

  if (isValidString(companyIdentifier)) {
    const extCompany = await searchExternalAccount(companyIdentifier);
    companyData = {
      ...(extCompany || {}),
      name: sanitizeCleanString(extCompany?.name || personData.company_name || input.company),
      website: sanitizeCleanString(extCompany?.website || personData.company_website || input.website),
      industry: sanitizeCleanString(extCompany?.industry || personData.industry),
      city: sanitizeCleanString(extCompany?.city || personData.city),
      state: sanitizeCleanString(extCompany?.state || personData.state),
      country: sanitizeCleanString(extCompany?.country || personData.country),
      postal_code: sanitizeCleanString(extCompany?.postal_code || personData.postal_code),
      address: sanitizeCleanString(extCompany?.address || personData.address),
      description: sanitizeCleanString(extCompany?.description || personData.description),
    };
  }

  const hasPersonData = Object.values(personData).some(v => isValidString(v) || (v && typeof v === "object" && Object.keys(v).length > 0));
  const hasCompanyData = Boolean(companyData && isValidString(companyData.name));

  return {
    success: hasPersonData || hasCompanyData,
    personFound: hasPersonData,
    companyFound: hasCompanyData,
    person: hasPersonData ? personData : null,
    company: hasCompanyData ? companyData : null,
    source,
  };
}
