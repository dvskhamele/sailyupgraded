import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import { prismadb } from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";

type RawRow = Record<string, string>;
type MappingKey =
  | "accountName"
  | "email"
  | "phone"
  | "website"
  | "fax"
  | "company_id"
  | "vat"
  | "annual_revenue"
  | "employees"
  | "member_of"
  | "industry"
  | "type"
  | "status"
  | "description"
  | "assigned_to"
  | "billing_street"
  | "billing_postal_code"
  | "billing_city"
  | "billing_state"
  | "billing_country"
  | "shipping_street"
  | "shipping_postal_code"
  | "shipping_city"
  | "shipping_state"
  | "shipping_country";
type ColumnMapping = Partial<Record<MappingKey, string>>;

const MAX_ROWS = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKIP_VALUE = "__skip__";

function mappedValue(row: RawRow, column?: string) {
  return column && column !== SKIP_VALUE ? String(row[column] ?? "").trim() : "";
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/[^\d+]/g, "");
  return normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized;
}

function normalizeWebsite(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function hasExistingValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function addIfMissing<T extends Record<string, unknown>>(
  update: T,
  field: keyof T,
  existingValue: unknown,
  nextValue: string | undefined,
) {
  if (!hasExistingValue(existingValue) && nextValue) {
    update[field] = nextValue as T[keyof T];
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = await requireOrganizationId();

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? (body.rows as RawRow[]) : [];
  const mapping = (body?.mapping || {}) as ColumnMapping;

  if (!mapping.accountName || mapping.accountName === SKIP_VALUE) {
    return NextResponse.json(
      { error: "Company or Company Name mapping is required" },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows provided for import" },
      { status: 400 },
    );
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Import limited to ${MAX_ROWS} rows per file` },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const seenNames = new Set<string>();
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const seenWebsites = new Set<string>();
  const failures: Array<{ row: number; name: string | null; reason: string }> = [];
  const candidates: Array<{
    row: number;
    normalizedName: string;
    normalizedEmail: string;
    normalizedPhone: string;
    normalizedWebsite: string;
    data: Record<MappingKey, string>;
  }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const accountName = mappedValue(row, mapping.accountName);
    const email = mappedValue(row, mapping.email);
    const phone = mappedValue(row, mapping.phone);
    const website = mappedValue(row, mapping.website);
    const normalizedName = normalizeLookup(accountName);
    const normalizedEmail = email ? normalizeEmail(email) : "";
    const normalizedPhone = phone ? normalizePhone(phone) : "";
    const normalizedWebsite = website ? normalizeWebsite(website) : "";

    if (!accountName) {
      failures.push({
        row: rowNumber,
        name: null,
        reason: "Skipped because Company or Company Name is empty",
      });
      return;
    }

    if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
      failures.push({
        row: rowNumber,
        name: accountName,
        reason: "Skipped because email format is invalid",
      });
      return;
    }

    if (normalizedPhone && normalizedPhone.replace(/\D/g, "").length < 7) {
      failures.push({
        row: rowNumber,
        name: accountName,
        reason: "Skipped because phone format is invalid",
      });
      return;
    }

    if (seenNames.has(normalizedName)) {
      failures.push({
        row: rowNumber,
        name: accountName,
        reason: "Duplicate company found in uploaded file",
      });
      return;
    }

    if (normalizedEmail && seenEmails.has(normalizedEmail)) {
      failures.push({
        row: rowNumber,
        name: accountName,
        reason: "Duplicate email found in uploaded file",
      });
      return;
    }

    if (normalizedPhone && seenPhones.has(normalizedPhone)) {
      failures.push({
        row: rowNumber,
        name: accountName,
        reason: "Duplicate phone found in uploaded file",
      });
      return;
    }

    if (normalizedWebsite && seenWebsites.has(normalizedWebsite)) {
      failures.push({
        row: rowNumber,
        name: accountName,
        reason: "Duplicate website found in uploaded file",
      });
      return;
    }

    seenNames.add(normalizedName);
    if (normalizedEmail) seenEmails.add(normalizedEmail);
    if (normalizedPhone) seenPhones.add(normalizedPhone);
    if (normalizedWebsite) seenWebsites.add(normalizedWebsite);

    candidates.push({
      row: rowNumber,
      normalizedName,
      normalizedEmail,
      normalizedPhone,
      normalizedWebsite,
      data: {
        accountName,
        email,
        phone,
        website,
        fax: mappedValue(row, mapping.fax),
        company_id: mappedValue(row, mapping.company_id),
        vat: mappedValue(row, mapping.vat),
        annual_revenue: mappedValue(row, mapping.annual_revenue),
        employees: mappedValue(row, mapping.employees),
        member_of: mappedValue(row, mapping.member_of),
        industry: mappedValue(row, mapping.industry),
        type: mappedValue(row, mapping.type),
        status: mappedValue(row, mapping.status),
        description: mappedValue(row, mapping.description),
        assigned_to: mappedValue(row, mapping.assigned_to),
        billing_street: mappedValue(row, mapping.billing_street),
        billing_postal_code: mappedValue(row, mapping.billing_postal_code),
        billing_city: mappedValue(row, mapping.billing_city),
        billing_state: mappedValue(row, mapping.billing_state),
        billing_country: mappedValue(row, mapping.billing_country),
        shipping_street: mappedValue(row, mapping.shipping_street),
        shipping_postal_code: mappedValue(row, mapping.shipping_postal_code),
        shipping_city: mappedValue(row, mapping.shipping_city),
        shipping_state: mappedValue(row, mapping.shipping_state),
        shipping_country: mappedValue(row, mapping.shipping_country),
      },
    });
  });

  return await runWithOrganizationContext(organizationId, async () => {
    const uniqueAssignedUserValues = Array.from(
      new Set(candidates.map((candidate) => candidate.data.assigned_to).filter(Boolean)),
    );
    const uniqueIndustryValues = Array.from(
      new Set(candidates.map((candidate) => candidate.data.industry).filter(Boolean)),
    );

    const [existingAccounts, users, industries] = await Promise.all([
      candidates.length
        ? prismadb.crm_Accounts.findMany({
            where: {
              deletedAt: null,
              OR: [
                { name: { in: candidates.map((candidate) => candidate.data.accountName) } },
                {
                  email: {
                    in: candidates
                      .map((candidate) => candidate.normalizedEmail)
                      .filter(Boolean),
                  },
                },
                {
                  office_phone: {
                    in: candidates
                      .map((candidate) => candidate.normalizedPhone)
                      .filter(Boolean),
                  },
                },
                {
                  website: {
                    in: candidates
                      .map((candidate) => candidate.data.website)
                      .filter(Boolean),
                  },
                },
              ],
            },
          })
        : Promise.resolve([]),
      uniqueAssignedUserValues.length
        ? prismadb.users.findMany({
            where: {
              OR: [
                { id: { in: uniqueAssignedUserValues } },
                { email: { in: uniqueAssignedUserValues } },
                { name: { in: uniqueAssignedUserValues } },
              ],
            },
            select: { id: true, email: true, name: true },
          })
        : Promise.resolve([]),
      uniqueIndustryValues.length
        ? prismadb.crm_Industry_Type.findMany({
            where: {
              OR: [
                { id: { in: uniqueIndustryValues } },
                { name: { in: uniqueIndustryValues } },
              ],
            },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const existingByName = new Map<string, (typeof existingAccounts)[number]>();
    const existingByEmail = new Map<string, (typeof existingAccounts)[number]>();
    const existingByPhone = new Map<string, (typeof existingAccounts)[number]>();
    const existingByWebsite = new Map<string, (typeof existingAccounts)[number]>();
    const userLookup = new Map<string, string>();
    const industryLookup = new Map<string, string>();

    existingAccounts.forEach((account) => {
      existingByName.set(normalizeLookup(account.name), account);
      if (account.email) existingByEmail.set(normalizeEmail(account.email), account);
      if (account.office_phone) {
        existingByPhone.set(normalizePhone(account.office_phone), account);
      }
      if (account.website) {
        existingByWebsite.set(normalizeWebsite(account.website), account);
      }
    });

    users.forEach((user) => {
      userLookup.set(user.id, user.id);
      if (user.email) userLookup.set(user.email, user.id);
      if (user.name) userLookup.set(user.name, user.id);
    });

    industries.forEach((industry) => {
      industryLookup.set(industry.id, industry.id);
      industryLookup.set(industry.name, industry.id);
    });

    let imported = 0;
    let updated = 0;

    for (const candidate of candidates) {
      const existingMatch =
        existingByName.get(candidate.normalizedName) ||
        (candidate.normalizedEmail
          ? existingByEmail.get(candidate.normalizedEmail)
          : undefined) ||
        (candidate.normalizedPhone
          ? existingByPhone.get(candidate.normalizedPhone)
          : undefined) ||
        (candidate.normalizedWebsite
          ? existingByWebsite.get(candidate.normalizedWebsite)
          : undefined);

      const resolvedAssignedTo = candidate.data.assigned_to
        ? userLookup.get(candidate.data.assigned_to)
        : undefined;
      const resolvedIndustry = candidate.data.industry
        ? industryLookup.get(candidate.data.industry)
        : undefined;

      const payload = {
        organizationId,
        name: candidate.data.accountName,
        email: candidate.normalizedEmail || undefined,
        office_phone: candidate.normalizedPhone || undefined,
        website: normalizeOptionalText(candidate.data.website),
        fax: normalizeOptionalText(candidate.data.fax),
        company_id: normalizeOptionalText(candidate.data.company_id),
        vat: normalizeOptionalText(candidate.data.vat),
        annual_revenue: normalizeOptionalText(candidate.data.annual_revenue),
        employees: normalizeOptionalText(candidate.data.employees),
        member_of: normalizeOptionalText(candidate.data.member_of),
        industry: resolvedIndustry,
        type: normalizeOptionalText(candidate.data.type),
        status: normalizeOptionalText(candidate.data.status) || "Active",
        description: normalizeOptionalText(candidate.data.description),
        assigned_to: resolvedAssignedTo,
        billing_street: normalizeOptionalText(candidate.data.billing_street),
        billing_postal_code: normalizeOptionalText(candidate.data.billing_postal_code),
        billing_city: normalizeOptionalText(candidate.data.billing_city),
        billing_state: normalizeOptionalText(candidate.data.billing_state),
        billing_country: normalizeOptionalText(candidate.data.billing_country),
        shipping_street: normalizeOptionalText(candidate.data.shipping_street),
        shipping_postal_code: normalizeOptionalText(candidate.data.shipping_postal_code),
        shipping_city: normalizeOptionalText(candidate.data.shipping_city),
        shipping_state: normalizeOptionalText(candidate.data.shipping_state),
        shipping_country: normalizeOptionalText(candidate.data.shipping_country),
      };

      try {
        if (existingMatch) {
          const updatePayload: Record<string, string> = {};
          addIfMissing(updatePayload, "email", existingMatch.email, payload.email);
          addIfMissing(updatePayload, "office_phone", existingMatch.office_phone, payload.office_phone);
          addIfMissing(updatePayload, "website", existingMatch.website, payload.website);
          addIfMissing(updatePayload, "fax", existingMatch.fax, payload.fax);
          addIfMissing(updatePayload, "company_id", existingMatch.company_id, payload.company_id);
          addIfMissing(updatePayload, "vat", existingMatch.vat, payload.vat);
          addIfMissing(updatePayload, "annual_revenue", existingMatch.annual_revenue, payload.annual_revenue);
          addIfMissing(updatePayload, "employees", existingMatch.employees, payload.employees);
          addIfMissing(updatePayload, "member_of", existingMatch.member_of, payload.member_of);
          addIfMissing(updatePayload, "industry", existingMatch.industry, payload.industry);
          addIfMissing(updatePayload, "type", existingMatch.type, payload.type);
          addIfMissing(updatePayload, "status", existingMatch.status, payload.status);
          addIfMissing(updatePayload, "description", existingMatch.description, payload.description);
          addIfMissing(updatePayload, "assigned_to", existingMatch.assigned_to, payload.assigned_to);
          addIfMissing(updatePayload, "billing_street", existingMatch.billing_street, payload.billing_street);
          addIfMissing(updatePayload, "billing_postal_code", existingMatch.billing_postal_code, payload.billing_postal_code);
          addIfMissing(updatePayload, "billing_city", existingMatch.billing_city, payload.billing_city);
          addIfMissing(updatePayload, "billing_state", existingMatch.billing_state, payload.billing_state);
          addIfMissing(updatePayload, "billing_country", existingMatch.billing_country, payload.billing_country);
          addIfMissing(updatePayload, "shipping_street", existingMatch.shipping_street, payload.shipping_street);
          addIfMissing(updatePayload, "shipping_postal_code", existingMatch.shipping_postal_code, payload.shipping_postal_code);
          addIfMissing(updatePayload, "shipping_city", existingMatch.shipping_city, payload.shipping_city);
          addIfMissing(updatePayload, "shipping_state", existingMatch.shipping_state, payload.shipping_state);
          addIfMissing(updatePayload, "shipping_country", existingMatch.shipping_country, payload.shipping_country);

          if (Object.keys(updatePayload).length === 0) {
            failures.push({
              row: candidate.row,
              name: candidate.data.accountName,
              reason: "Existing account already has the imported data",
            });
            continue;
          }

          await prismadb.crm_Accounts.update({
            where: { id: existingMatch.id },
            data: {
              updatedBy: userId,
              ...updatePayload,
            },
            select: { id: true },
          });
          updated += 1;
        } else {
          const created = await prismadb.crm_Accounts.create({
            data: {
              v: 0,
              createdBy: userId,
              updatedBy: userId,
              ...payload,
            },
            select: {
              id: true,
              name: true,
              email: true,
              office_phone: true,
              website: true,
            },
          });

          existingByName.set(normalizeLookup(created.name), created as any);
          if (created.email) existingByEmail.set(normalizeEmail(created.email), created as any);
          if (created.office_phone) {
            existingByPhone.set(normalizePhone(created.office_phone), created as any);
          }
          if (created.website) {
            existingByWebsite.set(normalizeWebsite(created.website), created as any);
          }
          imported += 1;
        }
      } catch (error) {
        failures.push({
          row: candidate.row,
          name: candidate.data.accountName,
          reason:
            error instanceof Error ? error.message : "Failed to import account",
        });
      }
    }

    if (imported > 0 || updated > 0) {
      await writeAuditLog({
        entityType: "account",
        entityId: "bulk_import",
        action: "imported",
        changes: [
          { field: "imported", old: null, new: imported },
          { field: "updated_missing_fields", old: null, new: updated },
          { field: "failed", old: null, new: failures.length },
        ],
        userId,
      });
    }

    revalidatePath("/[locale]/(routes)/crm/accounts", "page");
    revalidatePath("/[locale]/crm/accounts", "page");

    return NextResponse.json({
      imported,
      updated,
      failed: failures.length,
      failures,
    });
  });
}
