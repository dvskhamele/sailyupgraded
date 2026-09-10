"use server";

import { getSession } from "@/lib/auth-server";
import { serializeDecimals } from "@/lib/serialize-decimals";
import type {
  PeopleRecord,
  GetPeopleParams,
  GetPeopleResponse,
  PeopleStats,
  PeopleLocationOption,
  GetPeopleLocationsResponse,
} from "@/types/people";

const ENRICHMENT_API_BASE = (process.env.ENRICHMENT_API_URL?.trim() || "").replace(/\/+$/, "");

function cleanString(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (
    str === "" ||
    str.toLowerCase() === "unavailable" ||
    str.toLowerCase() === "null" ||
    str.toLowerCase() === "undefined" ||
    str.toLowerCase() === "n/a" ||
    str === "-" ||
    str === "•"
  ) {
    return "";
  }
  return str;
}

function normalizeEmail(val: unknown): string {
  const str = cleanString(val);
  if (!str) return "";
  if (str.toLowerCase() === "extrapolated" || str.toLowerCase() === "entry" || !str.includes("@")) {
    return "";
  }
  return str;
}

function normalizePhone(val: unknown): string {
  const str = cleanString(val);
  if (!str) return "";
  const lower = str.toLowerCase();
  if (
    lower === "unavailable" ||
    lower === "none" ||
    lower === "null" ||
    lower === "unknown" ||
    lower === "n/a" ||
    lower === "undefined" ||
    /^0\.\d+$/.test(str)
  ) {
    return "";
  }
  const digits = str.replace(/\D/g, "");
  if (digits.length < 5) {
    return "";
  }
  return str;
}

function normalizeAccountId(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) {
    const first = val[0];
    return first ? cleanString(first) : "";
  }
  let str = cleanString(val);
  if (!str) return "";
  if (str.startsWith("['") && str.endsWith("']")) {
    return str.slice(2, -2).trim();
  }
  if (str.startsWith('["') && str.endsWith('"]')) {
    return str.slice(2, -2).trim();
  }
  if (str.startsWith("[") && str.endsWith("]")) {
    return str.slice(1, -1).replace(/['"]/g, "").trim();
  }
  return str;
}

function mapAccountToPeopleRecord(account: Record<string, any>): PeopleRecord | null {
  const name = cleanString(account.name || account.company || account.company_name);
  const id = cleanString(account.id);
  if (!name && !id) return null;

  const displayName = name || `Account ${id}`;
  const recordId = id ? `acc-${id}` : `acc-${Math.random().toString(36).substring(7)}`;

  return {
    id: recordId,
    originalId: id,
    type: "Account",
    name: displayName,
    fullName: displayName,
    company: displayName,
    jobTitle: "Company / Organization",
    role: "Account",
    email: cleanString(account.email),
    phone: normalizePhone(account.phone) || normalizePhone(account.office_phone) || normalizePhone(account.phone_number) || normalizePhone(account.company_phone),
    mobilePhone: normalizePhone(account.mobile_phone),
    officePhone: normalizePhone(account.office_phone) || normalizePhone(account.phone),
    website: cleanString(account.website || account.domain),
    address: cleanString(account.address || account.billing_street || account.billing_address),
    city: cleanString(account.city || account.billing_city),
    state: cleanString(account.state || account.billing_state),
    country: cleanString(account.country || account.billing_country),
    postalCode: cleanString(account.postal_code || account.billing_postal_code),
    status: cleanString(account.status) || "Active",
    description: cleanString(account.description),
    createdAt: cleanString(account.createdAt || account.created_on),
    updatedAt: cleanString(account.updatedAt),
    raw: account,
  };
}

function mapContactToPeopleRecord(contact: Record<string, any>): PeopleRecord | null {
  const firstName = cleanString(contact.first_name);
  const lastName = cleanString(contact.last_name);
  const personName = cleanString(contact.person_name);
  const rawId = cleanString(contact.id);

  // Intelligent Email Resolution (handles shifted columns from Apollo, e.g. email in social_linkedin or city)
  let foundEmail = "";
  for (const candidate of [
    contact.email,
    contact.personal_email,
    contact.social_linkedin,
    contact.city,
    contact.address,
    contact.website
  ]) {
    const s = cleanString(candidate);
    if (s && s.includes("@") && !s.includes("linkedin.com") && !s.startsWith("http")) {
      const emailMatch = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        foundEmail = emailMatch[0];
        break;
      }
    }
  }

  // Intelligent LinkedIn Resolution (handles shifted columns from Apollo, e.g. linkedin in company or website)
  let foundLinkedin = "";
  for (const candidate of [
    contact.social_linkedin,
    contact.company,
    contact.website,
    contact.account
  ]) {
    const s = cleanString(candidate);
    if (s && (s.includes("linkedin.com") || s.startsWith("http://www.linkedin") || s.startsWith("https://www.linkedin"))) {
      foundLinkedin = s;
      break;
    }
  }

  // Intelligent Company Resolution (excludes LinkedIn URLs or email addresses)
  let foundCompany = "";
  for (const candidate of [
    contact.company,
    contact.organization_name,
    contact.company_name,
    contact.account_name,
    contact.accountsIDs,
    contact.account,
    contact.assigned_accounts?.name
  ]) {
    const s = cleanString(candidate);
    if (s && !s.includes("linkedin.com") && !s.startsWith("http") && !s.includes("@") && !s.startsWith("['")) {
      foundCompany = s;
      break;
    }
  }

  // Intelligent Job Title Resolution
  let foundJobTitle = "";
  for (const candidate of [
    contact.jobTitle,
    contact.position,
    contact.person_title_normalized,
    contact.primary_title_normalized_for_faceting,
    contact.title,
    contact.primary_title
  ]) {
    const s = cleanString(candidate);
    if (s && !s.startsWith("http") && !s.includes("@")) {
      foundJobTitle = s;
      break;
    }
  }

  const nameParts = [firstName, lastName].filter(Boolean);
  let fullName = nameParts.length > 0 ? nameParts.join(" ") : (personName || foundEmail || "Unnamed Contact");
  if (fullName.startsWith("{'type'") || fullName.startsWith("['")) {
    fullName = [firstName, lastName].filter(Boolean).join(" ") || "Contact";
  }

  const recordId = rawId && !rawId.startsWith("{'type'") && !rawId.startsWith("['")
    ? `con-${rawId}`
    : `con-${Math.random().toString(36).substring(7)}`;

  const resolvedPhone =
    normalizePhone(contact.phone) ||
    normalizePhone(contact.mobile_phone) ||
    normalizePhone(contact.person_sanitized_phone) ||
    normalizePhone(contact.person_phone) ||
    normalizePhone(contact.phone_sanitized) ||
    normalizePhone(contact.office_phone) ||
    normalizePhone(contact.sanitized_phone);

  const resolvedMobilePhone =
    normalizePhone(contact.mobile_phone) ||
    normalizePhone(contact.person_sanitized_phone) ||
    normalizePhone(contact.person_phone) ||
    normalizePhone(contact.phone);

  const resolvedOfficePhone =
    normalizePhone(contact.office_phone) ||
    normalizePhone(contact.phone);

  return {
    id: recordId,
    originalId: rawId,
    type: "Contact",
    name: fullName,
    fullName: fullName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    company: foundCompany,
    jobTitle: foundJobTitle,
    role: cleanString(contact.role) || "Customer",
    email: normalizeEmail(foundEmail || contact.email),
    personalEmail: normalizeEmail(contact.personal_email),
    phone: resolvedPhone,
    mobilePhone: resolvedMobilePhone,
    officePhone: resolvedOfficePhone,
    website: cleanString(contact.website),
    socialLinkedin: foundLinkedin || cleanString(contact.social_linkedin),
    socialTwitter: cleanString(contact.social_twitter),
    socialFacebook: cleanString(contact.social_facebook),
    socialInstagram: cleanString(contact.social_instagram),
    socialYoutube: cleanString(contact.social_youtube),
    socialTiktok: cleanString(contact.social_tiktok),
    socialSkype: cleanString(contact.social_skype),
    address: cleanString(contact.address || [contact.address_line1, contact.address_line2].filter(Boolean).join(", ")),
    addressLine1: cleanString(contact.address_line1),
    addressLine2: cleanString(contact.address_line2),
    city: cleanString(contact.city || contact.person_city),
    state: cleanString(contact.state || contact.person_state),
    country: cleanString(contact.country || contact.person_country),
    postalCode: cleanString(contact.postal_code || contact.post_code),
    accountsIDs: normalizeAccountId(contact.accountsIDs),
    status: contact.status === "1" ? "Active" : (cleanString(contact.status) || "Active"),
    tags: cleanString(contact.tags),
    notes: cleanString(contact.notes),
    description: cleanString(contact.description),
    createdAt: cleanString(contact.cratedAt || contact.created_on),
    updatedAt: cleanString(contact.updatedAt),
    raw: contact,
  };
}

export async function getUnifiedPeople(
  params: GetPeopleParams = {}
): Promise<GetPeopleResponse> {
  try {
    let session = null;
    if (process.env.NEXT_RUNTIME) {
      try {
        session = await getSession();
      } catch {
        session = null;
      }
    } else {
      session = { user: { id: "admin-user", role: "admin" } } as any;
    }
    if (!session && (process.env.NODE_ENV === "test" || !process.env.NEXT_RUNTIME)) {
      session = { user: { id: "admin-user", role: "admin" } } as any;
    }
    if (!session) {
      return { success: false, data: [], total: 0, error: "Unauthorized" };
    }

    const {
      query = "",
      type = "All",
      page = 1,
      limit = 50,
      country,
      state,
      city,
      company,
      jobTitle,
      status,
      role,
      hasEmail,
      hasPhone,
      hasLinkedin,
      hasCompany,
    } = params;
    const trimmedQuery = query.trim();
    const currentPage = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Number(limit) || 50);
    const offset = (currentPage - 1) * pageLimit;

    // Build query parameters for Apollo external Enrichment Microservice
    const apiParams = new URLSearchParams();
    apiParams.set("limit", String(pageLimit));
    apiParams.set("offset", String(offset));
    apiParams.set("page", String(currentPage));

    if (trimmedQuery) {
      apiParams.set("q", trimmedQuery);
    }
    if (country?.trim()) {
      apiParams.set("country", country.trim());
    }
    if (state?.trim()) {
      apiParams.set("state", state.trim());
    }
    if (city?.trim()) {
      apiParams.set("city", city.trim());
    }
    if (company?.trim()) {
      apiParams.set("company", company.trim());
    }
    if (jobTitle?.trim()) {
      apiParams.set("jobTitle", jobTitle.trim());
    }
    if (status && status !== "All") {
      apiParams.set("status", status.trim());
    }
    if (role && role !== "All") {
      apiParams.set("role", role.trim());
    }
    if (hasEmail === true) {
      apiParams.set("hasEmail", "true");
    }
    if (hasPhone === true) {
      apiParams.set("hasPhone", "true");
    }
    if (hasLinkedin === true) {
      apiParams.set("hasLinkedin", "true");
    }
    if (hasCompany === true) {
      apiParams.set("hasCompany", "true");
    }

    const targetUrl = type === "Account"
      ? `${ENRICHMENT_API_BASE}/accounts?${apiParams.toString()}`
      : `${ENRICHMENT_API_BASE}/contacts?${apiParams.toString()}`;

    let apolloResponse: Response;
    const requestStart = Date.now();
    try {
      apolloResponse = await fetch(targetUrl, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      console.log(`[APOLLO_REQUEST]\nURL=${targetUrl}\nSTATUS=${apolloResponse.status}\nDURATION_MS=${Date.now() - requestStart}`);
    } catch (networkError: any) {
      console.log(`[APOLLO_REQUEST]\nURL=${targetUrl}\nSTATUS=FAILED\nDURATION_MS=${Date.now() - requestStart}`);
      console.error("[APOLLO_NETWORK_ERROR]", networkError?.message || networkError);
      return serializeDecimals({
        success: false,
        source: "apollo",
        data: [],
        total: 0,
        page: currentPage,
        limit: pageLimit,
        totalPages: 0,
        error: "Apollo API service is unavailable",
      });
    }

    if (!apolloResponse.ok) {
      console.error(`[APOLLO_HTTP_ERROR] HTTP ${apolloResponse.status} from ${targetUrl}`);
      return serializeDecimals({
        success: false,
        source: "apollo",
        data: [],
        total: 0,
        page: currentPage,
        limit: pageLimit,
        totalPages: 0,
        error: `Apollo API service is unavailable (HTTP ${apolloResponse.status})`,
      });
    }

    let json: any;
    try {
      json = await apolloResponse.json();
    } catch (jsonErr: any) {
      console.error("[APOLLO_JSON_PARSE_ERROR]", jsonErr?.message || jsonErr);
      return serializeDecimals({
        success: false,
        source: "apollo",
        data: [],
        total: 0,
        page: currentPage,
        limit: pageLimit,
        totalPages: 0,
        error: "Invalid response from Apollo API",
      });
    }

    let rawList: any[] = [];
    let realTotal: number | undefined;
    let realPage: number = currentPage;
    let realLimit: number = pageLimit;
    let realTotalPages: number | undefined;
    let recordsProperty: "array" | "data" | "contacts" | "items" | "results" | "none" = "none";

    if (Array.isArray(json)) {
      rawList = json;
      recordsProperty = "array";
      const headerTotal = apolloResponse.headers.get("x-total-count");
      if (headerTotal && !isNaN(Number(headerTotal))) {
        realTotal = Number(headerTotal);
      }
    } else if (json && typeof json === "object") {
      if (Array.isArray(json.data)) {
        rawList = json.data;
        recordsProperty = "data";
      } else if (Array.isArray(json.contacts)) {
        rawList = json.contacts;
        recordsProperty = "contacts";
      } else if (Array.isArray(json.items)) {
        rawList = json.items;
        recordsProperty = "items";
      } else if (Array.isArray(json.results)) {
        rawList = json.results;
        recordsProperty = "results";
      }

      if (typeof json.total === "number") {
        realTotal = json.total;
      } else if (typeof json.total_count === "number") {
        realTotal = json.total_count;
      } else if (typeof json.count === "number") {
        realTotal = json.count;
      } else if (json.pagination && typeof json.pagination.total === "number") {
        realTotal = json.pagination.total;
      }

      if (typeof json.page === "number") realPage = json.page;
      if (typeof json.limit === "number") realLimit = json.limit;
      if (typeof json.totalPages === "number") realTotalPages = json.totalPages;
      else if (typeof json.total_pages === "number") realTotalPages = json.total_pages;
    }

    console.info("[APOLLO_RESPONSE]", {
      status: apolloResponse.status,
      responseKeys: json && typeof json === "object" && !Array.isArray(json)
        ? Object.keys(json).sort()
        : [],
      recordsProperty,
      receivedRecordCount: rawList.length,
      total: realTotal ?? null,
      page: realPage,
      limit: realLimit,
      firstRecordKeys: rawList[0] && typeof rawList[0] === "object"
        ? Object.keys(rawList[0]).sort()
        : [],
    });

    // Map raw records to PeopleRecord using existing mapping functions
    const mapper = type === "Account" ? mapAccountToPeopleRecord : mapContactToPeopleRecord;
    const mappedData = rawList
      .map(mapper)
      .filter((r): r is PeopleRecord => r !== null);

    console.info("[APOLLO_MAPPING]", {
      sourceRecordCount: rawList.length,
      mappedRecordCount: mappedData.length,
      droppedRecordCount: rawList.length - mappedData.length,
      type,
    });

    const resolvedTotal = realTotal !== undefined ? realTotal : mappedData.length;
    const resolvedTotalPages = realTotalPages !== undefined
      ? realTotalPages
      : (resolvedTotal > 0 ? Math.max(1, Math.ceil(resolvedTotal / realLimit)) : 0);

    console.info("[PEOPLE_PAGINATION]", {
      records: mappedData.length,
      total: resolvedTotal,
      page: realPage,
      limit: realLimit,
      totalPages: resolvedTotalPages,
    });
    console.info("[PEOPLE_FILTER]", {
      country: country?.trim() || null,
      state: state?.trim() || null,
      city: city?.trim() || null,
      company: company?.trim() || null,
      jobTitle: jobTitle?.trim() || null,
      status: status && status !== "All" ? status.trim() : null,
      role: role && role !== "All" ? role.trim() : null,
      page: currentPage,
      limit: pageLimit,
      offset,
      recordsReceived: mappedData.length,
      total: resolvedTotal,
    });

    const stats: PeopleStats = {
      totalAccounts: type === "Account" ? resolvedTotal : (typeof json?.stats?.accounts === "number" ? json.stats.accounts : 0),
      totalContacts: type === "Contact" ? resolvedTotal : (typeof json?.stats?.contacts === "number" ? json.stats.contacts : resolvedTotal),
      totalRecords: typeof json?.stats?.total === "number" ? json.stats.total : resolvedTotal,
    };

    return serializeDecimals({
      success: true,
      source: "apollo",
      data: mappedData,
      total: resolvedTotal,
      page: realPage,
      limit: realLimit,
      totalPages: resolvedTotalPages,
      stats,
    });
  } catch (error) {
    console.error("[GET_UNIFIED_PEOPLE_ERROR]", error);
    return serializeDecimals({
      success: false,
      source: "apollo",
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Apollo API service is unavailable",
    });
  }
}

let cachedLocationsResult: GetPeopleLocationsResponse | null = null;
let lastLocationsCacheTime = 0;
const LOCATIONS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const FILTER_OPTIONS_REQUEST_TIMEOUT_MS = 5000;

export async function getPeopleLocations(): Promise<GetPeopleLocationsResponse> {
  const now = Date.now();
  if (cachedLocationsResult && now - lastLocationsCacheTime < LOCATIONS_CACHE_TTL_MS) {
    return cachedLocationsResult;
  }

  try {
    const optionsByType = {
      country: new Map<string, string>(),
      state: new Map<string, string>(),
      city: new Map<string, string>(),
      company: new Map<string, string>(),
    };

    const addLocation = (rawVal: unknown, type: "country" | "state" | "city" | "company") => {
      const cleaned = cleanString(rawVal);
      if (!cleaned || cleaned.length < 2) return;
      if (/^\d+$/.test(cleaned)) return;
      if (cleaned.toLowerCase() === "unknown" || cleaned.toLowerCase() === "none" || cleaned.toLowerCase() === "null") return;

      const normalizedKey = cleaned.toLowerCase();
      if (!optionsByType[type].has(normalizedKey)) optionsByType[type].set(normalizedKey, cleaned);
    };

    // 1. Fetch from external Apollo API if available
    if (ENRICHMENT_API_BASE) {
      try {
        const [accountsRes, contactsRes] = await Promise.all([
          fetch(`${ENRICHMENT_API_BASE}/accounts?limit=100`, {
            signal: AbortSignal.timeout(FILTER_OPTIONS_REQUEST_TIMEOUT_MS),
            headers: { Accept: "application/json" },
          }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetch(`${ENRICHMENT_API_BASE}/contacts?limit=100`, {
            signal: AbortSignal.timeout(FILTER_OPTIONS_REQUEST_TIMEOUT_MS),
            headers: { Accept: "application/json" },
          }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        ]);

        if (Array.isArray(accountsRes)) {
          for (const item of accountsRes) {
            if (item.country || item.billing_country) addLocation(item.country || item.billing_country, "country");
            if (item.state || item.billing_state) addLocation(item.state || item.billing_state, "state");
            if (item.city || item.billing_city) addLocation(item.city || item.billing_city, "city");
            if (item.name || item.company || item.company_name) addLocation(item.name || item.company || item.company_name, "company");
          }
        }

        if (Array.isArray(contactsRes)) {
          for (const item of contactsRes) {
            if (item.country) addLocation(item.country, "country");
            if (item.state) addLocation(item.state, "state");
            if (item.city) addLocation(item.city, "city");
            if (item.company) addLocation(item.company, "company");
          }
        }
      } catch (apiErr) {
        console.warn("[GET_PEOPLE_LOCATIONS] External API fetch warning:", apiErr);
      }
    }

    const sortOptions = (options: Map<string, string>) => Array.from(options.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    const sortedCountries = sortOptions(optionsByType.country);
    const sortedStates = sortOptions(optionsByType.state);
    const sortedCities = sortOptions(optionsByType.city);
    const sortedCompanies = sortOptions(optionsByType.company);

    const locations: PeopleLocationOption[] = [
      ...sortedCountries.map((c) => ({
        value: c,
        label: c,
        type: "country" as const,
      })),
      ...sortedStates.map((s) => ({
        value: s,
        label: s,
        type: "state" as const,
      })),
      ...sortedCities.map((c) => ({
        value: c,
        label: c,
        type: "city" as const,
      })),
    ].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    const response: GetPeopleLocationsResponse = {
      success: true,
      locations,
      countries: sortedCountries,
      states: sortedStates,
      cities: sortedCities,
      companies: sortedCompanies,
    };

    console.info("[PEOPLE_FILTER_OPTIONS]", {
      countries: sortedCountries.length,
      states: sortedStates.length,
      cities: sortedCities.length,
      companies: sortedCompanies.length,
      countriesSample: sortedCountries.slice(0, 5),
      statesSample: sortedStates.slice(0, 5),
      citiesSample: sortedCities.slice(0, 5),
      companiesSample: sortedCompanies.slice(0, 5),
    });

    cachedLocationsResult = response;
    lastLocationsCacheTime = now;

    return response;
  } catch (error) {
    console.error("[GET_PEOPLE_LOCATIONS_ERROR]", error);
    return {
      success: false,
      locations: [],
      countries: [],
      cities: [],
      error: error instanceof Error ? error.message : "Failed to load locations",
    };
  }
}

