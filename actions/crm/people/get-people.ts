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
  PeopleFilterOptions,
} from "@/types/people";

const ENRICHMENT_API_BASE = (process.env.ENRICHMENT_API_URL?.trim() || "").replace(/\/+$/, "");
const MAX_PEOPLE_PAGE_SIZE = 5000;

function extractApolloRecords(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  for (const key of ["records", "data", "contacts", "accounts", "items", "results"]) {
    if (Array.isArray(body[key])) return body[key] as any[];
  }
  return [];
}

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
    const pageLimit = Math.min(MAX_PEOPLE_PAGE_SIZE, Math.max(1, Number(limit) || 50));
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
    let safeApiBase = "not configured";
    try {
      const parsedApiBase = new URL(ENRICHMENT_API_BASE);
      safeApiBase = `${parsedApiBase.protocol}//${parsedApiBase.host}${parsedApiBase.pathname.replace(/\/$/, "")}`;
    } catch {
      // Keep diagnostics safe when a deployment uses an invalid or relative base URL.
    }
    // Log only the final route and query, never the configured service origin
    // (which may contain deployment-specific credentials).
    const apolloRequestPathAndQuery = targetUrl.startsWith("/")
      ? targetUrl
      : targetUrl.replace(/^[a-z]+:\/\/[^/]+/i, "");

    let apolloResponse: Response;
    const requestStart = Date.now();
    console.info("[PRODUCTION_PEOPLE_REQUEST]", {
      endpoint: type === "Account" ? "/accounts" : "/contacts",
      apiBase: safeApiBase,
      page: currentPage,
      limit: pageLimit,
    });
    console.info("[PEOPLE_APOLLO_REQUEST]", {
      endpoint: type === "Account" ? "/accounts" : "/contacts",
      page: currentPage,
      limit: pageLimit,
      offset,
      finalPathAndQuery: apolloRequestPathAndQuery,
    });
    try {
      apolloResponse = await fetch(targetUrl, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch (networkError: any) {
      console.info("[PEOPLE_APOLLO_REQUEST]", {
        endpoint: type === "Account" ? "/accounts" : "/contacts",
        page: currentPage,
        limit: pageLimit,
        offset,
        status: "FAILED",
        durationMs: Date.now() - requestStart,
      });
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
      console.error("[APOLLO_HTTP_ERROR]", {
        endpoint: type === "Account" ? "/accounts" : "/contacts",
        status: apolloResponse.status,
        page: currentPage,
        limit: pageLimit,
        offset,
      });
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
    let recordsProperty: "array" | "records" | "data" | "contacts" | "items" | "results" | "none" = "none";

    if (Array.isArray(json)) {
      rawList = json;
      recordsProperty = "array";
      const headerTotal = apolloResponse.headers.get("x-total-count");
      if (headerTotal && !isNaN(Number(headerTotal))) {
        realTotal = Number(headerTotal);
      }
    } else if (json && typeof json === "object") {
      if (Array.isArray(json.records)) {
        rawList = json.records;
        recordsProperty = "records";
      } else if (Array.isArray(json.data)) {
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

    console.info("[PEOPLE_APOLLO_RESPONSE]", {
      recordsReceived: rawList.length,
      total: realTotal ?? null,
      page: currentPage,
      limit: pageLimit,
      offset,
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

    const resolvedTotal = realTotal;
    const resolvedTotalPages = realTotalPages !== undefined
      ? realTotalPages
      : (resolvedTotal !== undefined && resolvedTotal > 0 ? Math.max(1, Math.ceil(resolvedTotal / realLimit)) : undefined);

    console.info("[PEOPLE_PAGINATION]", {
      records: mappedData.length,
      total: resolvedTotal ?? null,
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
      total: resolvedTotal ?? null,
    });

    const stats: PeopleStats = {
      totalAccounts: type === "Account" ? (resolvedTotal ?? 0) : (typeof json?.stats?.accounts === "number" ? json.stats.accounts : 0),
      totalContacts: type === "Contact" ? (resolvedTotal ?? 0) : (typeof json?.stats?.contacts === "number" ? json.stats.contacts : 0),
      totalRecords: typeof json?.stats?.total === "number" ? json.stats.total : (resolvedTotal ?? 0),
    };

    return serializeDecimals({
      success: true,
      source: "apollo",
      data: mappedData,
      total: resolvedTotal ?? null,
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

const FILTER_OPTIONS_REQUEST_TIMEOUT_MS = 5000;

export async function getPeopleLocations(
  filters: Pick<PeopleFilterOptions, "country" | "state" | "city"> & { companyQuery?: string } = {}
): Promise<GetPeopleLocationsResponse> {
  try {
    if (!ENRICHMENT_API_BASE) throw new Error("Apollo API URL is not configured");
    const params = new URLSearchParams();
    if (filters.country?.trim()) params.set("country", filters.country.trim());
    if (filters.state?.trim()) params.set("state", filters.state.trim());
    if (filters.city?.trim()) params.set("city", filters.city.trim());
    if (filters.companyQuery?.trim()) params.set("company_q", filters.companyQuery.trim());
    const response = await fetch(`${ENRICHMENT_API_BASE}/contacts/filters?${params.toString()}`, {
      signal: AbortSignal.timeout(FILTER_OPTIONS_REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Apollo filter options request failed (HTTP ${response.status})`);
    const payload = await response.json() as Record<string, unknown>;
    const normalizeOptions = (values: unknown): string[] => {
      if (!Array.isArray(values)) return [];
      const deduped = new Map<string, string>();
      for (const value of values) {
        const cleaned = cleanString(value);
        if (!cleaned) continue;
        const key = cleaned.toLocaleLowerCase();
        if (!deduped.has(key)) deduped.set(key, cleaned);
      }
      return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    };
    const sortedCountries = normalizeOptions(payload.countries);
    const sortedStates = normalizeOptions(payload.states);
    const sortedCities = normalizeOptions(payload.cities);
    const sortedCompanies = normalizeOptions(payload.companies);

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

    const locationsResponse: GetPeopleLocationsResponse = {
      success: true,
      locations,
      countries: sortedCountries,
      states: sortedStates,
      cities: sortedCities,
      companies: sortedCompanies,
      locationRows: [],
    };

    console.info("[PEOPLE_FILTER_OPTIONS]", {
      countriesCount: sortedCountries.length,
      statesCount: sortedStates.length,
      citiesCount: sortedCities.length,
      companiesCount: sortedCompanies.length,
      countrySample: sortedCountries.slice(0, 10),
      stateSample: sortedStates.slice(0, 10),
      citySample: sortedCities.slice(0, 10),
      companySample: sortedCompanies.slice(0, 10),
    });

    return locationsResponse;
  } catch (error) {
    console.error("[GET_PEOPLE_LOCATIONS_ERROR]", error);
    return {
      success: false,
      locations: [],
      countries: [],
      states: [],
      cities: [],
      companies: [],
      error: error instanceof Error ? error.message : "Failed to load locations",
    };
  }
}

