import { prismadb } from "@/lib/prisma";
import { getAllApiKeys } from "@/lib/api-keys";
import { serializeDecimals, serializeDecimalsList } from "@/lib/serialize-decimals";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import {
  enrichPersonData,
  isValidString,
  sanitizeCleanString,
  EnrichedPersonData,
  EnrichedCompanyData,
  EnrichedDataResult,
  PersonEnrichmentInput,
} from "@/lib/enrichment/external-enrichment-service";
import {
  upsertOrganizationFromEnrichment,
  UpsertOrganizationResult,
} from "@/lib/enrichment/account-enrichment-service";
import type { crm_Leads } from "@prisma/client";

export interface BulkLeadEnrichmentResult {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  updatedLeads: any[];
  failedLeads: Array<{ id: string; name?: string; error: string }>;
  leadUpdated?: boolean;
  organizationUpdated?: boolean;
  organizationCreated?: boolean;
  lead?: any;
  organization?: any;
}

/**
 * Builds safe update data for crm_Leads model.
 *
 * SAFE FIELD OVERWRITE RULE:
 * - If CRM Lead field is empty/null: fills it with enriched value.
 * - If CRM Lead field already has a value: preserves the existing value.
 */
export function buildLeadUpdateData(
  lead: crm_Leads,
  enriched: EnrichedPersonData,
  organizationId?: string | null
): { updateData: Record<string, any>; updatedFieldNames: string[] } {
  const updateData: Record<string, any> = {};
  const updatedFieldNames: string[] = [];

  const checkAndSet = (
    field: keyof crm_Leads,
    enrichedVal: unknown,
    transform?: (v: string) => string
  ) => {
    if (!isValidString(enrichedVal)) return;
    const currentVal = (lead as any)[field];
    if (!isValidString(currentVal)) {
      const finalVal = transform
        ? transform(String(enrichedVal).trim())
        : String(enrichedVal).trim();
      updateData[field as string] = finalVal;
      updatedFieldNames.push(field as string);
    }
  };

  // Name fields
  checkAndSet("firstName", enriched.first_name);
  checkAndSet("lastName", enriched.last_name);

  // If full_name is present and firstName or lastName was empty
  if (
    isValidString(enriched.full_name) &&
    !updateData.firstName &&
    !isValidString(lead.firstName)
  ) {
    const parts = enriched.full_name.trim().split(/\s+/);
    if (parts.length > 0) {
      updateData.firstName = parts[0];
      updatedFieldNames.push("firstName");
      if (
        parts.length > 1 &&
        !updateData.lastName &&
        !isValidString(lead.lastName)
      ) {
        updateData.lastName = parts.slice(1).join(" ");
        updatedFieldNames.push("lastName");
      }
    }
  }

  // Email & Phones
  checkAndSet("email", enriched.email, (v) => v.toLowerCase());
  checkAndSet("personal_email", enriched.personal_email, (v) => v.toLowerCase());
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
  checkAndSet("social_skype", enriched.skype);
  checkAndSet("social_youtube", enriched.youtube);
  checkAndSet("social_tiktok", enriched.tiktok);

  // Description
  checkAndSet("description", enriched.description);

  // Address & Location
  checkAndSet("address", enriched.address || enriched.location);
  checkAndSet("address_line1", enriched.address_line1 || enriched.address || enriched.location);
  checkAndSet("address_line2", enriched.address_line2);
  checkAndSet("city", enriched.city);
  checkAndSet("state", enriched.state);
  checkAndSet("country", enriched.country);
  checkAndSet("postal_code", enriched.postal_code);

  // Link Organization / Account
  if (isValidString(organizationId) && !isValidString(lead.accountsIDs)) {
    updateData.accountsIDs = organizationId.trim();
    updatedFieldNames.push("accountsIDs");
  }

  // Custom Fields (Industry, Company Size, etc.)
  const currentCustom =
    lead.custom_fields_data &&
    typeof lead.custom_fields_data === "object" &&
    !Array.isArray(lead.custom_fields_data)
      ? { ...(lead.custom_fields_data as Record<string, unknown>) }
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
    !isValidString(lead.address)
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

/**
 * Updates ONLY the specified Lead and its linked Organization.
 *
 * CRITICAL ARCHITECTURE RULE:
 * This function NEVER mutates, creates, or touches crm_Contacts!
 */
export async function updateLeadFromEnrichment(
  leadId: string,
  enrichedData: EnrichedDataResult,
  userId?: string
): Promise<{
  success: boolean;
  lead: any;
  organization?: any;
  updatedFieldNames: string[];
  leadUpdated: boolean;
  organizationUpdated: boolean;
  organizationCreated: boolean;
}> {
  console.log(`[LEAD_ENRICH] Starting database update for Lead ID: ${leadId}`);

  const lead = await prismadb.crm_Leads.findUnique({
    where: { id: leadId },
    include: {
      assigned_accounts: true,
    },
  });

  if (!lead || lead.deletedAt) {
    console.warn(`[LEAD_ENRICH] Lead not found or deleted: ${leadId}`);
    throw new Error("Lead not found or already deleted");
  }

  let organization: any = lead.assigned_accounts || null;
  let organizationUpdated = false;
  let organizationCreated = false;
  let organizationId: string | null = lead.accountsIDs || null;

  // 1. Company enrichment / Organization upsert
  if (enrichedData.company && isValidString(enrichedData.company.name)) {
    console.log(`[LEAD_ENRICH] Company found: ${enrichedData.company.name}`);
    console.log(`[LEAD_ENRICH] Updating/creating Organization`);

    const orgResult: UpsertOrganizationResult = await upsertOrganizationFromEnrichment(
      enrichedData.company,
      userId
    );

    if (orgResult.account) {
      organization = orgResult.account;
      organizationId = orgResult.account.id;
      organizationCreated = orgResult.created;
      organizationUpdated = orgResult.updated;
      console.log(
        `[LEAD_ENRICH] Organization ${orgResult.created ? "created" : "resolved"}: ${orgResult.account.name} (ID: ${orgResult.account.id})`
      );
    }
  }

  // 2. Safe field overwrite for Lead
  let updatedLead = lead;
  let leadUpdated = false;
  let updatedFieldNames: string[] = [];

  if (enrichedData.person) {
    const { updateData, updatedFieldNames: fieldNames } = buildLeadUpdateData(
      lead,
      enrichedData.person,
      organizationId
    );
    updatedFieldNames = fieldNames;

    if (Object.keys(updateData).length > 0) {
      console.log(
        `[LEAD_ENRICH] Updating Lead ${leadId} fields: ${fieldNames.join(", ")}`
      );

      const safeUpdateData = await pickExistingDbModelFields("crm_Leads", {
        ...updateData,
        updatedAt: new Date(),
        updatedBy: userId,
      });

      updatedLead = await prismadb.crm_Leads.update({
        where: { id: lead.id },
        data: safeUpdateData as any,
        include: {
          assigned_accounts: true,
        },
      });
      leadUpdated = true;
    }
  } else if (organizationId && !isValidString(lead.accountsIDs)) {
    // If only organization was resolved
    const safeUpdateData = await pickExistingDbModelFields("crm_Leads", {
      accountsIDs: organizationId,
      updatedAt: new Date(),
      updatedBy: userId,
    });

    updatedLead = await prismadb.crm_Leads.update({
      where: { id: lead.id },
      data: safeUpdateData as any,
      include: {
        assigned_accounts: true,
      },
    });
    leadUpdated = true;
    updatedFieldNames.push("accountsIDs");
  }

  console.log(`[LEAD_ENRICH] Enrichment completed for Lead ID: ${leadId}`);

  return {
    success: true,
    lead: serializeDecimals(updatedLead),
    organization: organization ? serializeDecimals(organization) : undefined,
    updatedFieldNames,
    leadUpdated,
    organizationUpdated,
    organizationCreated,
  };
}

/**
 * Bulk Lead Enrichment Service
 *
 * Enriches one or more selected leads.
 * Updates ONLY crm_Leads and crm_Accounts.
 */
export async function bulkEnrichLeads(
  leadIds: string[],
  userId?: string
): Promise<BulkLeadEnrichmentResult> {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return {
      success: true,
      total: 0,
      successCount: 0,
      failedCount: 0,
      updatedLeads: [],
      failedLeads: [],
    };
  }

  console.log(`[LEAD_ENRICH] Starting enrichment for ${leadIds.length} lead(s)`);

  const leads = await prismadb.crm_Leads.findMany({
    where: {
      id: { in: leadIds },
      deletedAt: null,
    },
    include: {
      assigned_accounts: true,
    },
  });

  const leadsMap = new Map(leads.map((l: any) => [l.id, l]));

  // Candidate API keys (for AI fallback if external API misses)
  const openaiApiKeys = await getAllApiKeys("OPENAI", userId);
  const firecrawlApiKeys = await getAllApiKeys("FIRECRAWL", userId);
  const keys = {
    openaiApiKeys,
    openaiApiKey: openaiApiKeys[0] || null,
    firecrawlApiKey: firecrawlApiKeys[0] || null,
  };

  const updatedLeads: any[] = [];
  const failedLeads: Array<{ id: string; name?: string; error: string }> = [];
  let lastOrgResult: any = null;
  let anyLeadUpdated = false;
  let anyOrgUpdated = false;
  let anyOrgCreated = false;

  for (const id of leadIds) {
    const lead = leadsMap.get(id);

    if (!lead) {
      failedLeads.push({
        id,
        error: "Lead not found or already deleted",
      });
      continue;
    }

    const leadName =
      `${lead.firstName || ""} ${lead.lastName || ""}`.trim() ||
      lead.email ||
      lead.id;

    console.log(`[LEAD_ENRICH] Processing Lead ID: ${id} (${leadName})`);

    try {
      const hasEmail = isValidString(lead.email) || isValidString(lead.personal_email);
      const hasName = isValidString(lead.firstName) || isValidString(lead.lastName);
      const hasCompany = isValidString(lead.company) || isValidString(lead.assigned_accounts?.name);
      const hasWebsite = isValidString(lead.website) || isValidString(lead.assigned_accounts?.website);
      const hasPhone = isValidString(lead.phone) || isValidString(lead.mobile_phone) || isValidString(lead.office_phone);
      const hasLinkedin = isValidString(lead.social_linkedin);

      if (!hasEmail && !hasName && !hasCompany && !hasWebsite && !hasPhone && !hasLinkedin) {
        failedLeads.push({
          id,
          name: leadName,
          error: "Lead has no identifying information (email, name, company, website, phone, or LinkedIn).",
        });
        continue;
      }

      console.log(`[LEAD_ENRICH] Searching external person for Lead: ${leadName}`);

      const input: PersonEnrichmentInput = {
        id: lead.id,
        email: lead.email,
        personal_email: lead.personal_email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        mobile_phone: lead.mobile_phone,
        office_phone: lead.office_phone,
        company: lead.company || lead.assigned_accounts?.name,
        website: lead.website || lead.assigned_accounts?.website,
        linkedin: lead.social_linkedin,
        jobTitle: lead.jobTitle,
        position: lead.position,
        city: lead.city,
        state: lead.state,
        country: lead.country,
        address: lead.address || lead.address_line1,
      };

      const enrichedResult = await enrichPersonData(input, { keys });

      if (!enrichedResult.success && !enrichedResult.personFound && !enrichedResult.companyFound) {
        console.log(`[LEAD_ENRICH] No enrichment data found for Lead ID: ${id}`);
        failedLeads.push({
          id,
          name: leadName,
          error: "No enrichment data found for this lead.",
        });
        continue;
      }

      console.log(`[LEAD_ENRICH] Person found for Lead ID: ${id}`);

      const updateResult = await updateLeadFromEnrichment(id, enrichedResult, userId);

      if (updateResult.leadUpdated) anyLeadUpdated = true;
      if (updateResult.organizationUpdated) anyOrgUpdated = true;
      if (updateResult.organizationCreated) anyOrgCreated = true;
      if (updateResult.organization) lastOrgResult = updateResult.organization;

      updatedLeads.push(updateResult.lead);
    } catch (err: any) {
      console.error(`[LEAD_ENRICH] Failed to enrich lead ${id}:`, err);
      failedLeads.push({
        id,
        name: leadName,
        error: err?.message || "Failed to enrich lead",
      });
    }
  }

  const serializedUpdatedLeads = serializeDecimalsList(updatedLeads);

  return {
    success: true,
    total: leadIds.length,
    successCount: serializedUpdatedLeads.length,
    failedCount: failedLeads.length,
    updatedLeads: serializedUpdatedLeads,
    failedLeads,
    leadUpdated: anyLeadUpdated,
    organizationUpdated: anyOrgUpdated,
    organizationCreated: anyOrgCreated,
    lead: serializedUpdatedLeads[0] || null,
    organization: lastOrgResult,
  };
}
