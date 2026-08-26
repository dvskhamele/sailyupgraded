"use server";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { inngest } from "@/inngest/client";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { normalizeContactRole } from "@/lib/contact-options";
import { getAddressLine1 } from "@/lib/crm-address";
import { normalizeContactNotes } from "@/lib/crm/notes";
import { getSalesStageCollections } from "@/lib/crm-sales-stages";
import { connectUserById, resolveExistingUserId } from "@/lib/crm/resolve-user";
import { serializeDecimals } from "@/lib/serialize-decimals";
import type { PeopleRecord } from "@/types/people";

export type PeopleConversionStatus = "converted" | "already_exists" | "failed";

export type PeopleConversionItemResult = {
  id: string;
  originalId?: string;
  name: string;
  status: PeopleConversionStatus;
  targetId?: string;
  message?: string;
  targetType: "Contact" | "Lead";
};

export type ConvertPeopleResult = {
  success: boolean;
  targetType: "Contact" | "Lead";
  total: number;
  convertedCount: number;
  alreadyExistsCount: number;
  failedCount: number;
  results: PeopleConversionItemResult[];
  error?: string;
};

function cleanPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const str = raw.trim();
  const lower = str.toLowerCase();
  if (
    !str ||
    lower === "unavailable" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "n/a" ||
    lower === "none"
  ) {
    return null;
  }
  const digits = str.replace(/\D/g, "");
  if (digits.length < 5) return null;
  return str;
}

function cleanEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const str = raw.trim().toLowerCase();
  if (
    !str ||
    !str.includes("@") ||
    str === "unavailable" ||
    str === "extrapolated" ||
    str === "entry" ||
    str === "null"
  ) {
    return null;
  }
  return str;
}

function sanitizeCandidateAccountId(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    const first = val[0];
    return first ? sanitizeCandidateAccountId(first) : null;
  }
  let str = String(val).trim();
  if (!str) return null;

  // Handle bracketed/stringified arrays like "['5b1cea77a3ae611f68d96fec']" or '["5b1cea77a3ae611f68d96fec"]'
  if (str.startsWith("['") && str.endsWith("']")) {
    str = str.slice(2, -2).trim();
  } else if (str.startsWith('["') && str.endsWith('"]')) {
    str = str.slice(2, -2).trim();
  } else if (str.startsWith("[") && str.endsWith("]")) {
    str = str.slice(1, -1).replace(/['"]/g, "").trim();
  } else if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    str = str.slice(1, -1).trim();
  }

  // If string contains multiple entries separated by commas, pick the first
  if (str.includes(",")) {
    const parts = str.split(",");
    str = (parts[0] || "").replace(/['"\[\]]/g, "").trim();
  }

  return str || null;
}

function logAccountResolution(
  record: PeopleRecord,
  sourceIdentifier: string,
  resolvedId: string | undefined,
  accountExists: boolean,
  matchStrategy: string
) {
  console.log("[CONVERT_PEOPLE_ACCOUNT_RESOLVE]", {
    peopleRecordId: record.id,
    sourceIdentifier,
    sourceAccountsIDs: record.accountsIDs,
    sourceCompany: record.company,
    resolvedInternalAccountId: resolvedId || "none (unlinked, company name preserved)",
    accountExistsInDb: accountExists,
    matchStrategy,
    finalAccountsIDsValue: resolvedId || undefined,
  });
}

/**
 * Safely resolves a local CRM Account ID from a People record.
 * 
 * crm_Contacts.accountsIDs is a scalar foreign key to crm_Accounts.id.
 * If the candidate account ID or company name exists in the database,
 * it returns the valid crm_Accounts.id (UUID).
 * If no matching Account exists in the database, it returns undefined
 * so the foreign key constraint (P2003) is never violated, while
 * preserving the text company name on the contact/lead.
 */
async function resolveInternalAccountId(
  record: PeopleRecord,
  accountCache: Map<string, string | null>
): Promise<string | undefined> {
  const candidateIds: string[] = [];

  const rawAccountId = sanitizeCandidateAccountId(record.accountsIDs);
  if (rawAccountId) candidateIds.push(rawAccountId);

  if (record.raw) {
    const rawIds = sanitizeCandidateAccountId(record.raw.accountsIDs || record.raw.account || record.raw.account_id);
    if (rawIds && !candidateIds.includes(rawIds)) candidateIds.push(rawIds);
  }

  if (record.type === "Account" && record.originalId) {
    const origId = sanitizeCandidateAccountId(record.originalId);
    if (origId && !candidateIds.includes(origId)) candidateIds.push(origId);
  }

  // 1. Try resolving by Candidate Account IDs in local crm_Accounts
  for (const candidateId of candidateIds) {
    const cacheKey = `id:${candidateId}`;
    if (accountCache.has(cacheKey)) {
      const cached = accountCache.get(cacheKey);
      if (cached) {
        logAccountResolution(record, candidateId, cached, true, "id_cache");
        return cached;
      }
      continue;
    }

    try {
      const account = await prismadb.crm_Accounts.findFirst({
        where: { id: candidateId, deletedAt: null },
        select: { id: true, name: true },
      });

      if (account) {
        accountCache.set(cacheKey, account.id);
        logAccountResolution(record, candidateId, account.id, true, "id_match");
        return account.id;
      } else {
        accountCache.set(cacheKey, null);
      }
    } catch {
      accountCache.set(cacheKey, null);
    }
  }

  // 2. Try resolving by Company Name in local crm_Accounts
  const companyName = record.company?.trim() || (record.type === "Account" ? record.name?.trim() : undefined);
  if (
    companyName &&
    companyName !== "Company / Organization" &&
    companyName !== "Customer" &&
    companyName !== "Contact" &&
    companyName !== "Lead"
  ) {
    const cacheKey = `name:${companyName.toLowerCase()}`;
    if (accountCache.has(cacheKey)) {
      const cached = accountCache.get(cacheKey);
      if (cached) {
        logAccountResolution(record, companyName, cached, true, "name_cache");
        return cached;
      }
    } else {
      try {
        const account = await prismadb.crm_Accounts.findFirst({
          where: {
            name: { equals: companyName },
            deletedAt: null,
          },
          select: { id: true, name: true },
        });

        if (account) {
          accountCache.set(cacheKey, account.id);
          logAccountResolution(record, companyName, account.id, true, "name_match");
          return account.id;
        } else {
          accountCache.set(cacheKey, null);
        }
      } catch {
        accountCache.set(cacheKey, null);
      }
    }
  }

  // 3. No match found in database — return undefined so no invalid foreign key is inserted
  logAccountResolution(record, candidateIds[0] || companyName || "none", undefined, false, "no_match");
  return undefined;
}

function extractPersonNames(record: PeopleRecord): { firstName: string; lastName: string } {
  let firstName = (record.firstName || "").trim();
  let lastName = (record.lastName || "").trim();

  if (!firstName && !lastName) {
    const rawName = (record.name || record.fullName || "").trim();
    if (rawName && rawName !== "Company / Organization" && rawName !== "Contact" && rawName !== "Lead") {
      const parts = rawName.split(/\s+/);
      if (parts.length === 1) {
        firstName = parts[0];
        lastName = parts[0];
      } else {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }
    }
  }

  if (!firstName) firstName = "Unknown";
  if (!lastName) lastName = firstName || "Contact";

  return { firstName, lastName };
}

export async function convertPeopleToContacts(
  peopleRecords: PeopleRecord[]
): Promise<ConvertPeopleResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      success: false,
      targetType: "Contact",
      total: 0,
      convertedCount: 0,
      alreadyExistsCount: 0,
      failedCount: 0,
      results: [],
      error: "Unauthorized: You must be logged in to convert records.",
    };
  }

  const userId = session.user.id as string;
  if (!Array.isArray(peopleRecords) || peopleRecords.length === 0) {
    return {
      success: false,
      targetType: "Contact",
      total: 0,
      convertedCount: 0,
      alreadyExistsCount: 0,
      failedCount: 0,
      results: [],
      error: "No records selected for conversion.",
    };
  }

  const results: PeopleConversionItemResult[] = [];
  const accountCache = new Map<string, string | null>();

  for (const record of peopleRecords) {
    const name = record.fullName || record.name || "Unnamed Record";
    const email = cleanEmail(record.email) || cleanEmail(record.personalEmail);
    const phone = cleanPhone(record.phone) || cleanPhone(record.mobilePhone) || cleanPhone(record.officePhone);

    // If type is Account, verify that person/contact data is available
    if (record.type === "Account") {
      const hasPersonData = Boolean(
        record.firstName ||
        (record.lastName && record.lastName !== record.name) ||
        email ||
        phone
      );

      if (!hasPersonData) {
        results.push({
          id: record.id,
          originalId: record.originalId,
          name,
          status: "failed",
          targetType: "Contact",
          message: `${name} cannot be converted because no valid contact/person information is available.`,
        });
        continue;
      }
    }

    try {
      // 1. Duplicate Detection Check
      let existingContact: { id: string } | null = null;

      // Check by originalId if already a Contact
      if (record.type === "Contact" && record.originalId && !record.originalId.startsWith("acc-") && !record.originalId.startsWith("con-")) {
        existingContact = await prismadb.crm_Contacts.findFirst({
          where: { id: record.originalId, deletedAt: null },
          select: { id: true },
        });
      }

      // Check by email
      if (!existingContact && email) {
        existingContact = await prismadb.crm_Contacts.findFirst({
          where: {
            OR: [
              { email: { equals: email, mode: "insensitive" } },
              { personal_email: { equals: email, mode: "insensitive" } },
            ],
            deletedAt: null,
          },
          select: { id: true },
        });
      }

      // Check by phone
      if (!existingContact && phone) {
        existingContact = await prismadb.crm_Contacts.findFirst({
          where: {
            OR: [
              { phone: { equals: phone } },
              { mobile_phone: { equals: phone } },
              { office_phone: { equals: phone } },
            ],
            deletedAt: null,
          },
          select: { id: true },
        });
      }

      if (existingContact) {
        results.push({
          id: record.id,
          originalId: record.originalId,
          name,
          status: "already_exists",
          targetId: existingContact.id,
          targetType: "Contact",
          message: `${name} already exists as a Contact in Saily CRM.`,
        });
        continue;
      }

      // 2. Resolve Names and Account linkage (Foreign Key Safe)
      const { firstName, lastName } = extractPersonNames(record);
      const resolvedAddress = getAddressLine1(record.address, record.addressLine1);
      const resolvedAccountId = await resolveInternalAccountId(record, accountCache);

      // 3. Prepare Payload
      const contactPayload = await pickExistingDbModelFields("crm_Contacts", {
        v: 1,
        first_name: firstName,
        last_name: lastName,
        company: record.company || (record.type === "Account" ? record.name : undefined),
        jobTitle: record.jobTitle && record.jobTitle !== "Company / Organization" ? record.jobTitle : undefined,
        position: record.jobTitle && record.jobTitle !== "Company / Organization" ? record.jobTitle : undefined,
        email: email || undefined,
        personal_email: cleanEmail(record.personalEmail) || undefined,
        phone: phone || undefined,
        mobile_phone: cleanPhone(record.mobilePhone) || undefined,
        office_phone: cleanPhone(record.officePhone) || undefined,
        address: resolvedAddress || undefined,
        address_line1: resolvedAddress || undefined,
        address_line2: record.addressLine2 || undefined,
        city: record.city || undefined,
        state: record.state || undefined,
        country: record.country || undefined,
        postal_code: record.postalCode || undefined,
        website: record.website || undefined,
        social_linkedin: record.socialLinkedin || undefined,
        social_twitter: record.socialTwitter || undefined,
        social_facebook: record.socialFacebook || undefined,
        social_instagram: record.socialInstagram || undefined,
        social_youtube: record.socialYoutube || undefined,
        social_tiktok: record.socialTiktok || undefined,
        social_skype: record.socialSkype || undefined,
        description: record.description || undefined,
        accountsIDs: resolvedAccountId || undefined,
        assigned_to: userId,
        role: normalizeContactRole(record.role || "Customer"),
        status: true,
        createdBy: userId,
        created_by: userId,
        updatedBy: userId,
        last_activity_by: userId,
        notes: normalizeContactNotes(record.notes),
        custom_fields_data: record.raw?.custom_fields_data || null,
      });

      // 4. Create Contact Record
      const createdContact = await prismadb.crm_Contacts.create({
        data: contactPayload as any,
        select: { id: true, first_name: true, last_name: true },
      });

      // 5. Audit Log & Events
      await writeAuditLog({
        entityType: "contact",
        entityId: createdContact.id,
        action: "created",
        changes: [{ field: "source", old: null, new: "converted_from_people" }],
        userId,
      });
      void inngest.send({ name: "crm/contact.saved", data: { record_id: createdContact.id } }).catch(() => {});

      results.push({
        id: record.id,
        originalId: record.originalId,
        name: `${firstName} ${lastName}`.trim() || name,
        status: "converted",
        targetId: createdContact.id,
        targetType: "Contact",
        message: `Successfully converted into Contact.`,
      });
    } catch (err: any) {
      console.error(`[CONVERT_PEOPLE_TO_CONTACT_ERROR] Record ${record.id}:`, err);
      results.push({
        id: record.id,
        originalId: record.originalId,
        name,
        status: "failed",
        targetType: "Contact",
        message: err.message || "Failed to create contact record.",
      });
    }
  }

  const convertedCount = results.filter((r) => r.status === "converted").length;
  const alreadyExistsCount = results.filter((r) => r.status === "already_exists").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  revalidatePath("/[locale]/(routes)/crm/contacts", "page");
  revalidatePath("/[locale]/(routes)/crm/people", "page");

  return {
    success: convertedCount > 0 || (alreadyExistsCount > 0 && failedCount === 0),
    targetType: "Contact",
    total: peopleRecords.length,
    convertedCount,
    alreadyExistsCount,
    failedCount,
    results,
  };
}

export async function convertPeopleToLeads(
  peopleRecords: PeopleRecord[]
): Promise<ConvertPeopleResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      success: false,
      targetType: "Lead",
      total: 0,
      convertedCount: 0,
      alreadyExistsCount: 0,
      failedCount: 0,
      results: [],
      error: "Unauthorized: You must be logged in to convert records.",
    };
  }

  const userId = session.user.id as string;
  if (!Array.isArray(peopleRecords) || peopleRecords.length === 0) {
    return {
      success: false,
      targetType: "Lead",
      total: 0,
      convertedCount: 0,
      alreadyExistsCount: 0,
      failedCount: 0,
      results: [],
      error: "No records selected for conversion.",
    };
  }

  const results: PeopleConversionItemResult[] = [];
  const accountCache = new Map<string, string | null>();

  for (const record of peopleRecords) {
    const name = record.fullName || record.name || "Unnamed Record";
    const email = cleanEmail(record.email) || cleanEmail(record.personalEmail);
    const phone = cleanPhone(record.phone) || cleanPhone(record.mobilePhone) || cleanPhone(record.officePhone);

    // If type is Account, verify that person/contact data is available
    if (record.type === "Account") {
      const hasPersonData = Boolean(
        record.firstName ||
        (record.lastName && record.lastName !== record.name) ||
        email ||
        phone
      );

      if (!hasPersonData) {
        results.push({
          id: record.id,
          originalId: record.originalId,
          name,
          status: "failed",
          targetType: "Lead",
          message: `${name} cannot be converted because no valid contact/person information is available.`,
        });
        continue;
      }
    }

    try {
      // 1. Duplicate Detection Check in Leads
      let existingLead: { id: string } | null = null;

      // Check by originalId
      if (record.originalId && !record.originalId.startsWith("acc-") && !record.originalId.startsWith("con-")) {
        existingLead = await prismadb.crm_Leads.findFirst({
          where: { id: record.originalId, deletedAt: null },
          select: { id: true },
        });
      }

      // Check by email
      if (!existingLead && email) {
        existingLead = await prismadb.crm_Leads.findFirst({
          where: {
            OR: [
              { email: { equals: email, mode: "insensitive" } },
              { personal_email: { equals: email, mode: "insensitive" } },
            ],
            deletedAt: null,
          },
          select: { id: true },
        });
      }

      // Check by phone
      if (!existingLead && phone) {
        existingLead = await prismadb.crm_Leads.findFirst({
          where: {
            OR: [
              { phone: { equals: phone } },
              { mobile_phone: { equals: phone } },
              { office_phone: { equals: phone } },
            ],
            deletedAt: null,
          },
          select: { id: true },
        });
      }

      if (existingLead) {
        results.push({
          id: record.id,
          originalId: record.originalId,
          name,
          status: "already_exists",
          targetId: existingLead.id,
          targetType: "Lead",
          message: `${name} already exists as a Lead in Saily CRM.`,
        });
        continue;
      }

      // 2. Resolve Names and Account linkage (Foreign Key Safe)
      const { firstName, lastName } = extractPersonNames(record);
      const resolvedAddress = getAddressLine1(record.address, record.addressLine1);
      const resolvedAccountId = await resolveInternalAccountId(record, accountCache);

      // 3. Prepare Lead Payload
      const leadPayload = await pickExistingDbModelFields("crm_Leads", {
        v: 1,
        firstName,
        lastName,
        company: record.company || (record.type === "Account" ? record.name : undefined),
        jobTitle: record.jobTitle && record.jobTitle !== "Company / Organization" ? record.jobTitle : undefined,
        position: record.jobTitle && record.jobTitle !== "Company / Organization" ? record.jobTitle : undefined,
        email: email || undefined,
        personal_email: cleanEmail(record.personalEmail) || undefined,
        phone: phone || undefined,
        mobile_phone: cleanPhone(record.mobilePhone) || undefined,
        office_phone: cleanPhone(record.officePhone) || undefined,
        address: resolvedAddress || undefined,
        address_line1: resolvedAddress || undefined,
        address_line2: record.addressLine2 || undefined,
        city: record.city || undefined,
        state: record.state || undefined,
        country: record.country || undefined,
        postal_code: record.postalCode || undefined,
        website: record.website || undefined,
        social_linkedin: record.socialLinkedin || undefined,
        social_twitter: record.socialTwitter || undefined,
        social_facebook: record.socialFacebook || undefined,
        social_instagram: record.socialInstagram || undefined,
        social_youtube: record.socialYoutube || undefined,
        social_tiktok: record.socialTiktok || undefined,
        social_skype: record.socialSkype || undefined,
        description: record.description || undefined,
        accountsIDs: resolvedAccountId || undefined,
        assigned_to: userId,
        role: normalizeContactRole(record.role || "Customer"),
        status: true,
        createdBy: userId,
        updatedBy: userId,
        custom_fields_data: record.raw?.custom_fields_data || null,
      });

      // 4. Create Lead Record
      const createdLead = await prismadb.crm_Leads.create({
        data: leadPayload as any,
        select: { id: true, firstName: true, lastName: true },
      });

      // 5. Create Pipeline Opportunity for Lead
      try {
        const { firstStage } = await getSalesStageCollections();
        const resolvedAssignedTo = await resolveExistingUserId(userId);
        const resolvedCreatedBy = await resolveExistingUserId(userId);
        const assignedAccount = resolvedAccountId
          ? await prismadb.crm_Accounts.findFirst({
              where: { id: resolvedAccountId, deletedAt: null },
              select: { id: true },
            })
          : null;

        const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
        const opportunityName =
          fullName ||
          record.company ||
          email ||
          phone ||
          "Converted Lead";

        await prismadb.crm_Opportunities.create({
          data: {
            assigned_account: assignedAccount ? { connect: { id: assignedAccount.id } } : undefined,
            assigned_to_user: connectUserById(resolvedAssignedTo),
            assigned_sales_stage: firstStage ? { connect: { id: firstStage.id } } : undefined,
            clientName: fullName || null,
            created_by_user: connectUserById(resolvedCreatedBy),
            createdBy: userId,
            updatedBy: userId,
            last_activity_by: userId,
            custom_fields_data: {
              manualLeadSource: {
                leadId: createdLead.id,
                firstName,
                lastName,
                company: record.company || null,
                email: email || null,
                phone: phone || null,
              },
            },
            description: `Converted from People record (${record.type}): ${name}`,
            name: opportunityName,
            next_step: "New converted lead intake",
            status: "ACTIVE",
          },
          select: { id: true },
        });
      } catch (oppErr) {
        console.error("[CONVERT_PEOPLE_LEAD_OPPORTUNITY_ERROR]", oppErr);
      }

      // 6. Audit Log & Events
      await writeAuditLog({
        entityType: "lead",
        entityId: createdLead.id,
        action: "created",
        changes: [{ field: "source", old: null, new: "converted_from_people" }],
        userId,
      });
      void inngest.send({ name: "crm/lead.saved", data: { record_id: createdLead.id } }).catch(() => {});

      results.push({
        id: record.id,
        originalId: record.originalId,
        name: `${firstName} ${lastName}`.trim() || name,
        status: "converted",
        targetId: createdLead.id,
        targetType: "Lead",
        message: `Successfully converted into Lead.`,
      });
    } catch (err: any) {
      console.error(`[CONVERT_PEOPLE_TO_LEAD_ERROR] Record ${record.id}:`, err);
      results.push({
        id: record.id,
        originalId: record.originalId,
        name,
        status: "failed",
        targetType: "Lead",
        message: err.message || "Failed to create lead record.",
      });
    }
  }

  const convertedCount = results.filter((r) => r.status === "converted").length;
  const alreadyExistsCount = results.filter((r) => r.status === "already_exists").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  revalidatePath("/[locale]/(routes)/crm/leads", "page");
  revalidatePath("/[locale]/(routes)/crm/people", "page");

  return {
    success: convertedCount > 0 || (alreadyExistsCount > 0 && failedCount === 0),
    targetType: "Lead",
    total: peopleRecords.length,
    convertedCount,
    alreadyExistsCount,
    failedCount,
    results,
  };
}
