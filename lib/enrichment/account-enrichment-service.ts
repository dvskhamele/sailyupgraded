import { prismadb } from "@/lib/prisma";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import {
  EnrichedCompanyData,
  isValidString,
  sanitizeCleanString,
} from "./external-enrichment-service";
import type { crm_Accounts } from "@prisma/client";

export interface UpsertOrganizationResult {
  account: crm_Accounts | null;
  created: boolean;
  updated: boolean;
}

export function extractDomainFromUrl(url: string | null | undefined): string | null {
  if (!isValidString(url)) return null;
  try {
    const withProto = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Searches for an existing Organization / Account by name, website, or external ID.
 * Prevents duplicate organization creation.
 */
export async function findExistingOrganization(
  company: EnrichedCompanyData
): Promise<crm_Accounts | null> {
  const companyName = sanitizeCleanString(company.name);
  const companyWebsite = sanitizeCleanString(company.website);
  const domain = extractDomainFromUrl(companyWebsite);

  if (!companyName && !domain && !company.id) {
    return null;
  }

  // 1. Search by exact name
  if (companyName) {
    const byName = await prismadb.crm_Accounts.findFirst({
      where: {
        name: companyName,
        deletedAt: null,
      },
    });
    if (byName) return byName;
  }

  // 2. Search by website / domain if available
  if (domain) {
    const byDomain = await prismadb.crm_Accounts.findFirst({
      where: {
        website: { contains: domain },
        deletedAt: null,
      },
    });
    if (byDomain) return byDomain;
  }

  // 3. Case-insensitive search on first 100 accounts if small
  if (companyName) {
    const lowerName = companyName.toLowerCase();
    const candidateAccounts = await prismadb.crm_Accounts.findMany({
      where: { deletedAt: null },
      take: 200,
    });
    const matched = candidateAccounts.find(
      (acc) => acc.name && acc.name.toLowerCase() === lowerName
    );
    if (matched) return matched;
  }

  return null;
}

/**
 * Upserts an Organization (crm_Accounts) from enriched company data.
 * - If organization exists: updates only empty/null fields.
 * - If not found: creates new organization if sufficient data (e.g. name) is present.
 */
export async function upsertOrganizationFromEnrichment(
  companyData: EnrichedCompanyData,
  userId?: string
): Promise<UpsertOrganizationResult> {
  const companyName = sanitizeCleanString(companyData.name);
  if (!companyName) {
    return { account: null, created: false, updated: false };
  }

  const existing = await findExistingOrganization(companyData);

  if (existing) {
    // Build safe update data for null/empty fields
    const updateData: Record<string, any> = {};

    const checkAndSet = (field: keyof crm_Accounts, val: unknown) => {
      if (!isValidString(val)) return;
      const currentVal = (existing as any)[field];
      if (!isValidString(currentVal)) {
        updateData[field as string] = String(val).trim();
      }
    };

    checkAndSet("website", companyData.website);
    checkAndSet("email", companyData.email);
    checkAndSet("office_phone", companyData.phone);
    checkAndSet("description", companyData.description);
    checkAndSet("employees", companyData.employeeCount);
    checkAndSet("annual_revenue", companyData.revenue);
    checkAndSet("billing_city", companyData.city);
    checkAndSet("billing_state", companyData.state);
    checkAndSet("billing_country", companyData.country);
    checkAndSet("billing_postal_code", companyData.postal_code);
    checkAndSet("billing_street", companyData.address);
    checkAndSet("shipping_city", companyData.city);
    checkAndSet("shipping_state", companyData.state);
    checkAndSet("shipping_country", companyData.country);
    checkAndSet("shipping_postal_code", companyData.postal_code);
    checkAndSet("shipping_street", companyData.address);

    let updatedAccount = existing;
    let didUpdate = false;

    if (Object.keys(updateData).length > 0) {
      const safeData = await pickExistingDbModelFields("crm_Accounts", {
        ...updateData,
        updatedAt: new Date(),
        updatedBy: userId,
      });

      updatedAccount = await prismadb.crm_Accounts.update({
        where: { id: existing.id },
        data: safeData as any,
      });
      didUpdate = true;
    }

    return { account: updatedAccount, created: false, updated: didUpdate };
  }

  // Create new organization
  const newAccountData: Record<string, any> = {
    v: 0,
    name: companyName,
    website: sanitizeCleanString(companyData.website) || undefined,
    email: sanitizeCleanString(companyData.email) || undefined,
    office_phone: sanitizeCleanString(companyData.phone) || undefined,
    description: sanitizeCleanString(companyData.description) || undefined,
    employees: sanitizeCleanString(companyData.employeeCount) || undefined,
    annual_revenue: sanitizeCleanString(companyData.revenue) || undefined,
    billing_city: sanitizeCleanString(companyData.city) || undefined,
    billing_state: sanitizeCleanString(companyData.state) || undefined,
    billing_country: sanitizeCleanString(companyData.country) || undefined,
    billing_postal_code: sanitizeCleanString(companyData.postal_code) || undefined,
    billing_street: sanitizeCleanString(companyData.address) || undefined,
    shipping_city: sanitizeCleanString(companyData.city) || undefined,
    shipping_state: sanitizeCleanString(companyData.state) || undefined,
    shipping_country: sanitizeCleanString(companyData.country) || undefined,
    shipping_postal_code: sanitizeCleanString(companyData.postal_code) || undefined,
    shipping_street: sanitizeCleanString(companyData.address) || undefined,
    status: "Active",
    type: "Customer",
    createdBy: userId,
    updatedBy: userId,
  };

  const safeCreateData = await pickExistingDbModelFields("crm_Accounts", newAccountData);

  const createdAccount = await prismadb.crm_Accounts.create({
    data: safeCreateData as any,
  });

  return { account: createdAccount, created: true, updated: false };
}
