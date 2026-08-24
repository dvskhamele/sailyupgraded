import { prismadb } from "@/lib/prisma";
import {
  getApiKey,
  getAllApiKeys,
  sanitizeApiKey,
  maskApiKey,
} from "@/lib/api-keys";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import type { crm_Contacts } from "@prisma/client";
import OpenAI from "openai";
import FirecrawlApp from "@mendable/firecrawl-js";

export interface EnrichedContactData {
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
  company_name?: string | null;
  company_website?: string | null;
  industry?: string | null;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  company_size?: string | null;
  description?: string | null;
  other_info?: Record<string, unknown> | null;
}

export interface BulkEnrichmentResult {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  updatedContacts: any[];
  failedContacts: Array<{ id: string; name?: string; error: string }>;
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
    lower === "unknown"
  ) {
    return false;
  }
  return true;
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
  if (!isValidString(email)) {
    return {
      domain: null,
      companyGuess: null,
      isPersonal: false,
      firstNameGuess: null,
      lastNameGuess: null,
    };
  }

  const parts = email.trim().toLowerCase().split("@");
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

export async function fetchEnrichmentFromProvider(
  contact: Partial<crm_Contacts> & { assigned_accounts?: { name?: string | null; website?: string | null } | null },
  keys: {
    openaiApiKey?: string | null;
    openaiApiKeys?: string[];
    firecrawlApiKey?: string | null;
  }
): Promise<EnrichedContactData> {
  const email = contact.email || contact.personal_email || null;
  const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  const company = contact.company || contact.assigned_accounts?.name || null;
  const website = contact.website || contact.assigned_accounts?.website || null;
  const position = contact.position || contact.jobTitle || null;

  const emailInfo = parseEmailInfo(email);
  let scrapedContent = "";

  // 1. If Firecrawl key is available, search web for contact/company details
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
          console.warn(`[BulkEnrichment] Firecrawl search query '${query}' failed:`, e);
        }
      }
    } catch (err) {
      console.warn("[BulkEnrichment] Firecrawl initialization or search failed:", err);
    }
  }

  // 2. If OpenAI key(s) available, try LLM extraction with fallback between candidates
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
Given the following contact information and scraped web content, enrich and extract all available valid data for this contact and their company.

Contact known data:
- Full Name: ${fullName || "Unknown"}
- First Name: ${contact.first_name || "Unknown"}
- Last Name: ${contact.last_name || "Unknown"}
- Email: ${email || "Unknown"}
- Company: ${company || "Unknown"}
- Website: ${website || "Unknown"}
- Title/Position: ${position || "Unknown"}
- Phone: ${contact.phone || contact.mobile_phone || contact.office_phone || "Unknown"}
- LinkedIn: ${contact.social_linkedin || "Unknown"}
- Address/Location: ${contact.city || contact.address || contact.country || "Unknown"}

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
        const parsed = JSON.parse(content) as EnrichedContactData;
        return parsed;
      }
    } catch (err: any) {
      const isAuthError =
        err?.status === 401 ||
        err?.code === "invalid_api_key" ||
        err?.message?.includes("Incorrect API key provided") ||
        err?.message?.includes("invalid_api_key");

      if (isAuthError) {
        console.warn(
          `[BulkEnrichment] OpenAI key ${maskApiKey(sanitizedKey)} is invalid (401). Trying next candidate key if available...`
        );
      } else {
        console.warn("[BulkEnrichment] OpenAI enrichment failed:", err?.message || err);
      }
    }
  }

  // 3. Heuristic fallback when external AI keys are unavailable or fail
  const fallbackResult: EnrichedContactData = {};

  if (emailInfo.firstNameGuess && !isValidString(contact.first_name)) {
    fallbackResult.first_name = emailInfo.firstNameGuess;
  }
  if (emailInfo.lastNameGuess && !isValidString(contact.last_name)) {
    fallbackResult.last_name = emailInfo.lastNameGuess;
  }
  if (emailInfo.companyGuess && !isValidString(contact.company)) {
    fallbackResult.company_name = emailInfo.companyGuess;
  }
  if (emailInfo.domain && !emailInfo.isPersonal && !isValidString(contact.website)) {
    fallbackResult.company_website = `https://${emailInfo.domain}`;
  }

  return fallbackResult;
}

export function buildContactUpdateData(
  contact: crm_Contacts,
  enriched: EnrichedContactData
): { updateData: Record<string, any>; updatedFieldNames: string[] } {
  const updateData: Record<string, any> = {};
  const updatedFieldNames: string[] = [];

  const checkAndSet = (
    field: keyof crm_Contacts,
    enrichedVal: unknown,
    transform?: (v: string) => string
  ) => {
    if (!isValidString(enrichedVal)) return;
    const currentVal = (contact as any)[field];
    if (!isValidString(currentVal)) {
      const finalVal = transform
        ? transform(enrichedVal.trim())
        : enrichedVal.trim();
      updateData[field as string] = finalVal;
      updatedFieldNames.push(field as string);
    }
  };

  // Name fields
  checkAndSet("first_name", enriched.first_name);
  checkAndSet("last_name", enriched.last_name);

  // If full_name is present and first_name/last_name were empty
  if (
    isValidString(enriched.full_name) &&
    !updateData.first_name &&
    !isValidString(contact.first_name)
  ) {
    const parts = enriched.full_name.trim().split(/\s+/);
    if (parts.length > 0) {
      updateData.first_name = parts[0];
      updatedFieldNames.push("first_name");
      if (
        parts.length > 1 &&
        !updateData.last_name &&
        !isValidString(contact.last_name)
      ) {
        updateData.last_name = parts.slice(1).join(" ");
        updatedFieldNames.push("last_name");
      }
    }
  }

  // Email & Phones
  checkAndSet("email", enriched.email, (v) => v.toLowerCase());
  checkAndSet("personal_email", enriched.personal_email, (v) =>
    v.toLowerCase()
  );
  checkAndSet("phone", enriched.phone);
  checkAndSet("mobile_phone", enriched.mobile_phone || enriched.phone);
  checkAndSet("office_phone", enriched.office_phone || enriched.phone);

  // Job & Position
  checkAndSet("jobTitle", enriched.job_title || enriched.position);
  checkAndSet("position", enriched.position || enriched.job_title);

  // Company & Website
  checkAndSet("company", enriched.company_name);
  checkAndSet("website", enriched.company_website, (v) =>
    v.startsWith("http") ? v : `https://${v}`
  );

  // Social Links
  checkAndSet("social_linkedin", enriched.linkedin_url);
  checkAndSet("social_twitter", enriched.twitter_url);
  checkAndSet("social_facebook", enriched.facebook_url);
  checkAndSet("social_instagram", enriched.instagram_url);

  // Description & Notes
  checkAndSet("description", enriched.description);

  // Address & Location
  checkAndSet("address", enriched.address || enriched.location);
  checkAndSet("address_line1", enriched.address || enriched.location);
  checkAndSet("city", enriched.city);
  checkAndSet("state", enriched.state);
  checkAndSet("country", enriched.country);
  checkAndSet("postal_code", enriched.postal_code);

  // Custom Fields (Industry, Company Size, etc.)
  const currentCustom =
    contact.custom_fields_data &&
    typeof contact.custom_fields_data === "object" &&
    !Array.isArray(contact.custom_fields_data)
      ? { ...(contact.custom_fields_data as Record<string, unknown>) }
      : {};

  let customChanged = false;

  if (
    isValidString(enriched.industry) &&
    !isValidString(currentCustom.industry)
  ) {
    currentCustom.industry = enriched.industry.trim();
    customChanged = true;
    updatedFieldNames.push("industry");
  }

  if (
    isValidString(enriched.company_size) &&
    !isValidString(currentCustom.company_size)
  ) {
    currentCustom.company_size = enriched.company_size.trim();
    customChanged = true;
    updatedFieldNames.push("company_size");
  }

  if (
    isValidString(enriched.location) &&
    !isValidString(currentCustom.location) &&
    !isValidString(contact.address)
  ) {
    currentCustom.location = enriched.location.trim();
    customChanged = true;
    updatedFieldNames.push("location");
  }

  if (enriched.other_info && typeof enriched.other_info === "object") {
    for (const [k, v] of Object.entries(enriched.other_info)) {
      if (isValidString(v) && !isValidString(currentCustom[k])) {
        currentCustom[k] = (v as string).trim();
        customChanged = true;
        updatedFieldNames.push(k);
      }
    }
  }

  if (customChanged) {
    updateData.custom_fields_data = currentCustom;
  }

  return { updateData, updatedFieldNames };
}

export async function bulkEnrichContacts(
  contactIds: string[],
  userId?: string
): Promise<BulkEnrichmentResult> {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return {
      success: true,
      total: 0,
      successCount: 0,
      failedCount: 0,
      updatedContacts: [],
      failedContacts: [],
    };
  }

  const select = await getCrmContactListSelect();

  // Fetch only the selected contacts from database using safe select
  const contacts = await prismadb.crm_Contacts.findMany({
    where: {
      id: { in: contactIds },
      deletedAt: null,
    },
    select,
  });

  const contactsMap = new Map(contacts.map((c: any) => [c.id, c]));

  // Resolve candidate API keys (OpenAI, Firecrawl) across ENV, SYSTEM, USER scopes
  const openaiApiKeys = await getAllApiKeys("OPENAI", userId);
  const firecrawlApiKeys = await getAllApiKeys("FIRECRAWL", userId);
  const keys = {
    openaiApiKeys,
    openaiApiKey: openaiApiKeys[0] || null,
    firecrawlApiKey: firecrawlApiKeys[0] || null,
  };

  const updatedContacts: any[] = [];
  const failedContacts: Array<{ id: string; name?: string; error: string }> = [];

  // Process selected contacts
  for (const id of contactIds) {
    const contact = contactsMap.get(id);

    if (!contact) {
      failedContacts.push({
        id,
        error: "Contact not found or already deleted",
      });
      continue;
    }

    const contactName =
      `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
      contact.email ||
      contact.id;

    try {
      // Check if contact has at least some data to base enrichment on
      const hasEmail = isValidString(contact.email) || isValidString(contact.personal_email);
      const hasName = isValidString(contact.first_name) || isValidString(contact.last_name);
      const hasCompany = isValidString(contact.company) || isValidString(contact.assigned_accounts?.name);
      const hasWebsite = isValidString(contact.website) || isValidString(contact.assigned_accounts?.website);

      if (!hasEmail && !hasName && !hasCompany && !hasWebsite) {
        failedContacts.push({
          id,
          name: contactName,
          error: "Contact has no identifying information (email, name, company, or website).",
        });
        continue;
      }

      // Fetch enrichment details
      const enrichedData = await fetchEnrichmentFromProvider(contact, keys);

      // Build safe update data (never overwrite valid existing CRM values with null/empty)
      const { updateData, updatedFieldNames } = buildContactUpdateData(
        contact,
        enrichedData
      );

      let resultContact: any = contact;

      if (Object.keys(updateData).length > 0) {
        const safeUpdateData = await pickExistingDbModelFields(
          "crm_Contacts",
          updateData
        );

        resultContact = await prismadb.crm_Contacts.update({
          where: { id: contact.id },
          data: {
            ...safeUpdateData,
            updatedAt: new Date(),
          },
          select,
        });
      }

      updatedContacts.push(resultContact);
    } catch (err: any) {
      console.error(`[BulkEnrichment] Failed to enrich contact ${id}:`, err);
      failedContacts.push({
        id,
        name: contactName,
        error: err?.message || "Failed to enrich contact",
      });
    }
  }

  const serializedUpdatedContacts = serializeDecimalsList(updatedContacts);

  return {
    success: true,
    total: contactIds.length,
    successCount: serializedUpdatedContacts.length,
    failedCount: failedContacts.length,
    updatedContacts: serializedUpdatedContacts,
    failedContacts,
  };
}
