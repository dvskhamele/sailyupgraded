import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import {
  type ContactRole,
  detectContactRole,
  inferContactRoleFromIdentifierContext,
  normalizeContactRole,
} from "@/lib/contact-options";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { prismadb } from "@/lib/prisma";

type RawRow = Record<string, string>;
type MappingKey =
  | "serial"
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "personal_email"
  | "mobile_phone"
  | "office_phone"
  | "website"
  | "position"
  | "description"
  | "birthday"
  | "address"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "country"
  | "postal_code"
  | "status"
  | "role"
  | "contact_type_id"
  | "assigned_to"
  | "assigned_account"
  | "social_twitter"
  | "social_facebook"
  | "social_linkedin"
  | "social_skype"
  | "social_youtube"
  | "social_tiktok";
type ColumnMapping = Partial<Record<MappingKey, string>>;

const MAX_ROWS = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitFullName(name: string, fallbackEmail: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      first_name: "",
      last_name: fallbackEmail.split("@")[0] || "Imported Contact",
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      first_name: "",
      last_name: parts[0],
    };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/[^\d+]/g, "");
  return normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized;
}

function mappedValue(row: RawRow, column?: string) {
  return column ? String(row[column] ?? "").trim() : "";
}

function parseStatus(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "1", "yes", "y", "active", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "inactive", "disabled"].includes(normalized)) return false;
  return undefined;
}

function parseSerial(value: string): string | undefined {
  return value.trim() || undefined;
}

function getFallbackSerialPrefix(role: ContactRole) {
  switch (role) {
    case "Agent":
      return "AGT";
    case "Partner":
      return "PRT";
    case "Vendor":
      return "VND";
    case "Other":
      return "OTH";
    case "Customer":
    default:
      return "CUST";
  }
}

function generateFallbackSerial(role: ContactRole, row: number, importBatchId: string) {
  return `${getFallbackSerialPrefix(role)}-${importBatchId}-${String(row).padStart(4, "0")}`;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

const ROLE_REFERENCE_ID_HEADERS = {
  agent: ["agentNumber", "agentId", "agent number", "agent id", "agent no", "agent code"],
  customer: ["customerNumber", "customerId", "customer number", "customer id", "customer no", "customer code"],
  client: ["clientNumber", "clientId", "client number", "client id", "client no", "client code"],
  other: ["otherNumber", "otherId", "other number", "other id", "other no", "other code"],
} as const;

const GENERIC_REFERENCE_ID_HEADERS = [
  "referenceId",
  "referenceNumber",
  "reference id",
  "reference number",
  "role id",
  "serial",
  "contact id",
  "contactid",
  "contact_id",
];

function normalizeHeaderToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getReferenceHeaderGroup(role: ContactRole) {
  switch (role) {
    case "Agent":
      return "agent";
    case "Customer":
      return "customer";
    default:
      return "other";
  }
}

function findReferenceIdFromRow(row: RawRow, role: ContactRole) {
  const roleSpecificHeaders = ROLE_REFERENCE_ID_HEADERS[getReferenceHeaderGroup(role)];
  const orderedCandidates = [...roleSpecificHeaders, ...GENERIC_REFERENCE_ID_HEADERS].map(
    normalizeHeaderToken,
  );

  for (const candidate of orderedCandidates) {
    for (const [header, value] of Object.entries(row)) {
      const normalizedHeader = normalizeHeaderToken(header);
      const isMatch = normalizedHeader === candidate || normalizedHeader.includes(candidate);
      const normalizedValue = value.trim();
      if (isMatch && normalizedValue) {
        return normalizedValue;
      }
    }
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? (body.rows as RawRow[]) : [];
  const mapping = (body?.mapping || {}) as ColumnMapping;
  const duplicateMode =
    body?.duplicateMode === "update" ? "update" : "skip";

  if (!mapping.name && !mapping.last_name) {
    return NextResponse.json(
      { error: "Full name or last name mapping is required" },
      { status: 400 },
    );
  }

  if (!mapping.email && !mapping.mobile_phone && !mapping.office_phone) {
    return NextResponse.json(
      { error: "At least one of email, mobile phone, or office phone mapping is required" },
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
  const importBatchId = Date.now().toString(36).toUpperCase();
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const failures: Array<{ row: number; email: string | null; reason: string }> = [];
  const candidates: Array<{
    row: number;
    normalizedEmail: string;
    normalizedMobilePhone: string;
    normalizedOfficePhone: string;
    rawRow: RawRow;
    data: Record<string, string>;
  }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = mappedValue(row, mapping.email);
    const normalizedEmail = email ? normalizeEmail(email) : "";
    const firstName = mappedValue(row, mapping.first_name);
    const lastName = mappedValue(row, mapping.last_name);
    const fullName = mappedValue(row, mapping.name);
    const mobilePhone = mappedValue(row, mapping.mobile_phone);
    const officePhone = mappedValue(row, mapping.office_phone);
    const normalizedMobilePhone = mobilePhone ? normalizePhone(mobilePhone) : "";
    const normalizedOfficePhone = officePhone ? normalizePhone(officePhone) : "";
    const computedName = fullName || [firstName, lastName].filter(Boolean).join(" ");

    if (!computedName && !lastName) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because full name and last name are empty",
      });
      return;
    }

    if (!normalizedEmail && !normalizedMobilePhone && !normalizedOfficePhone) {
      failures.push({
        row: rowNumber,
        email: null,
        reason: "Skipped because email and phone fields are empty",
      });
      return;
    }

    if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail,
        reason: "Skipped because email format is invalid",
      });
      return;
    }

    if (normalizedMobilePhone && normalizedMobilePhone.replace(/\D/g, "").length < 7) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because mobile phone format is invalid",
      });
      return;
    }

    if (normalizedOfficePhone && normalizedOfficePhone.replace(/\D/g, "").length < 7) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because office phone format is invalid",
      });
      return;
    }

    if (normalizedEmail && seenEmails.has(normalizedEmail)) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail,
        reason: "Duplicate email found in uploaded file",
      });
      return;
    }

    if (
      (normalizedMobilePhone && seenPhones.has(normalizedMobilePhone)) ||
      (normalizedOfficePhone && seenPhones.has(normalizedOfficePhone))
    ) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Duplicate phone found in uploaded file",
      });
      return;
    }

    if (normalizedEmail) {
      seenEmails.add(normalizedEmail);
    }
    if (normalizedMobilePhone) {
      seenPhones.add(normalizedMobilePhone);
    }
    if (normalizedOfficePhone) {
      seenPhones.add(normalizedOfficePhone);
    }
    candidates.push({
      row: rowNumber,
      normalizedEmail,
      normalizedMobilePhone,
      normalizedOfficePhone,
      rawRow: row,
      data: Object.fromEntries(
        Object.entries(mapping)
          .filter(([, column]) => Boolean(column))
          .map(([field, column]) => [field, mappedValue(row, column)]),
      ),
    });
  });

  const existingContacts = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          email: {
            in: candidates
              .map((candidate) => candidate.normalizedEmail)
              .filter(Boolean),
          },
        },
        {
          mobile_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedMobilePhone)
              .filter(Boolean),
          },
        },
        {
          mobile_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedOfficePhone)
              .filter(Boolean),
          },
        },
        {
          office_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedMobilePhone)
              .filter(Boolean),
          },
        },
        {
          office_phone: {
            in: candidates
              .map((candidate) => candidate.normalizedOfficePhone)
              .filter(Boolean),
          },
        },
      ],
    },
    select: {
      id: true,
      serial: true,
      email: true,
      mobile_phone: true,
      office_phone: true,
    },
  });

  const existingByEmail = new Map<string, { id: string; serial: string | null }>();
  const existingByPhone = new Map<string, { id: string; serial: string | null }>();

  const uniqueAssignedUserValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.assigned_to?.trim()).filter(Boolean)),
  );
  const uniqueAccountValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.assigned_account?.trim()).filter(Boolean)),
  );
  const uniqueContactTypeValues = Array.from(
    new Set(candidates.map((candidate) => candidate.data.contact_type_id?.trim()).filter(Boolean)),
  );

  const [users, accounts, contactTypes] = await Promise.all([
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
    uniqueAccountValues.length
      ? prismadb.crm_Accounts.findMany({
          where: {
            deletedAt: null,
            OR: [{ id: { in: uniqueAccountValues } }, { name: { in: uniqueAccountValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueContactTypeValues.length
      ? prismadb.crm_Contact_Types.findMany({
          where: {
            OR: [{ id: { in: uniqueContactTypeValues } }, { name: { in: uniqueContactTypeValues } }],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const userLookup = new Map<string, string>();
  const accountLookup = new Map<string, string>();
  const contactTypeLookup = new Map<string, string>();

  users.forEach((user) => {
    userLookup.set(user.id, user.id);
    if (user.email) userLookup.set(user.email, user.id);
    if (user.name) userLookup.set(user.name, user.id);
  });
  accounts.forEach((account) => {
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(normalizeLookupKey(account.name), account.id);
  });
  contactTypes.forEach((contactType) => {
    contactTypeLookup.set(contactType.id, contactType.id);
    contactTypeLookup.set(contactType.name, contactType.id);
  });

  existingContacts.forEach((contact) => {
    const normalizedEmail = contact.email ? normalizeEmail(contact.email) : "";
    const mobilePhone = contact.mobile_phone
      ? normalizePhone(contact.mobile_phone)
      : "";
    const officePhone = contact.office_phone
      ? normalizePhone(contact.office_phone)
      : "";

    if (normalizedEmail) {
      existingByEmail.set(normalizedEmail, { id: contact.id, serial: contact.serial });
    }
    if (mobilePhone) {
      existingByPhone.set(mobilePhone, { id: contact.id, serial: contact.serial });
    }
    if (officePhone) {
      existingByPhone.set(officePhone, { id: contact.id, serial: contact.serial });
    }
  });

  const missingAccountNames = uniqueAccountValues.filter((value) => {
    const trimmed = value.trim();
    return trimmed && !accountLookup.get(trimmed) && !accountLookup.get(normalizeLookupKey(trimmed));
  });
  const uniqueMissingAccountNames = Array.from(
    new Map(missingAccountNames.map((name) => [normalizeLookupKey(name), name.trim()])).values(),
  );

  for (const accountName of uniqueMissingAccountNames) {
    const account = await prismadb.crm_Accounts.create({
      data: {
        v: 0,
        name: accountName,
        status: "Active",
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true, name: true },
    });
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(normalizeLookupKey(account.name), account.id);
  }

  let imported = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existingMatch =
      (candidate.normalizedEmail
        ? existingByEmail.get(candidate.normalizedEmail)
        : undefined) ||
      (candidate.normalizedMobilePhone
        ? existingByPhone.get(candidate.normalizedMobilePhone)
        : undefined) ||
      (candidate.normalizedOfficePhone
        ? existingByPhone.get(candidate.normalizedOfficePhone)
        : undefined);

    if (existingMatch && duplicateMode === "skip") {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason: "Existing contact matched by email or phone",
      });
      continue;
    }

    const firstNameValue = candidate.data.first_name;
    const lastNameValue = candidate.data.last_name;
    const computedName = candidate.data.name || [firstNameValue, lastNameValue].filter(Boolean).join(" ");
    const { first_name, last_name } =
      firstNameValue || lastNameValue
        ? {
            first_name: firstNameValue || "",
            last_name:
              lastNameValue ||
              candidate.normalizedEmail.split("@")[0] ||
              candidate.normalizedMobilePhone ||
              candidate.normalizedOfficePhone ||
              "Imported Contact",
          }
        : splitFullName(
            computedName,
            candidate.normalizedEmail ||
              candidate.normalizedMobilePhone ||
              candidate.normalizedOfficePhone ||
              computedName,
          );

    const assignedToRaw = candidate.data.assigned_to?.trim() || "";
    const assignedAccountRaw = candidate.data.assigned_account?.trim() || "";
    const contactTypeRaw = candidate.data.contact_type_id?.trim() || "";
    const resolvedAssignedTo = assignedToRaw ? userLookup.get(assignedToRaw) : undefined;
    const resolvedAssignedAccount = assignedAccountRaw
      ? accountLookup.get(assignedAccountRaw) ?? accountLookup.get(normalizeLookupKey(assignedAccountRaw))
      : undefined;
    const resolvedContactType = contactTypeRaw
      ? contactTypeLookup.get(contactTypeRaw)
      : undefined;

    const parsedStatus = parseStatus(candidate.data.status || "");
    const inferredRoleFromIdentifier = inferContactRoleFromIdentifierContext(
      mapping.serial,
      mapping.role,
      candidate.data.role,
    );
    const resolvedRole =
      detectContactRole(candidate.data.role) ??
      inferredRoleFromIdentifier;

    if (!resolvedRole) {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason: "Role could not be detected. Add a Role column or use a role-specific ID header like AgentNumber or CustomerID.",
      });
      continue;
    }

    const normalizedRole = normalizeContactRole(resolvedRole);
    const serial = findReferenceIdFromRow(candidate.rawRow, normalizedRole) ||
      parseSerial(candidate.data.serial || "");
    const resolvedSerial =
      serial ||
      existingMatch?.serial ||
      generateFallbackSerial(normalizedRole, candidate.row, importBatchId);
    const supportedSerialField = await pickExistingDbModelFields("crm_Contacts", {
      serial: resolvedSerial,
    });

    const contactPayload = {
      ...supportedSerialField,
      first_name: first_name || undefined,
      last_name,
      email: candidate.normalizedEmail || undefined,
      personal_email: normalizeOptionalText(candidate.data.personal_email),
      mobile_phone: candidate.normalizedMobilePhone || undefined,
      office_phone: candidate.normalizedOfficePhone || undefined,
      website: normalizeOptionalText(candidate.data.website),
      position: normalizeOptionalText(candidate.data.position),
      description: normalizeOptionalText(candidate.data.description),
      birthday: normalizeOptionalText(candidate.data.birthday),
      address: normalizeOptionalText(candidate.data.address),
      address_line1: normalizeOptionalText(candidate.data.address_line1),
      address_line2: normalizeOptionalText(candidate.data.address_line2),
      city: normalizeOptionalText(candidate.data.city),
      state: normalizeOptionalText(candidate.data.state),
      country: normalizeOptionalText(candidate.data.country),
      postal_code: normalizeOptionalText(candidate.data.postal_code),
      status: parsedStatus ?? true,
      assigned_to: resolvedAssignedTo,
      accountsIDs: resolvedAssignedAccount,
      contact_type_id: resolvedContactType,
      social_twitter: normalizeOptionalText(candidate.data.social_twitter),
      social_facebook: normalizeOptionalText(candidate.data.social_facebook),
      social_linkedin: normalizeOptionalText(candidate.data.social_linkedin),
      social_skype: normalizeOptionalText(candidate.data.social_skype),
      social_youtube: normalizeOptionalText(candidate.data.social_youtube),
      social_tiktok: normalizeOptionalText(candidate.data.social_tiktok),
      ...(await pickExistingDbModelFields("crm_Contacts", {
        role: normalizedRole,
      })),
    };

    try {
      if (existingMatch) {
        await prismadb.crm_Contacts.update({
          where: { id: existingMatch.id },
          data: {
            updatedBy: userId,
            ...contactPayload,
          } as any,
          select: { id: true },
        });
        updated += 1;
      } else {
        const created = await prismadb.crm_Contacts.create({
          data: {
            v: 1,
            createdBy: userId,
            updatedBy: userId,
            ...contactPayload,
            tags: [],
            notes: [],
          } as any,
          select: { id: true },
        });

        if (candidate.normalizedEmail) {
          existingByEmail.set(candidate.normalizedEmail, { id: created.id, serial: resolvedSerial });
        }
        if (candidate.normalizedMobilePhone) {
          existingByPhone.set(candidate.normalizedMobilePhone, { id: created.id, serial: resolvedSerial });
        }
        if (candidate.normalizedOfficePhone) {
          existingByPhone.set(candidate.normalizedOfficePhone, { id: created.id, serial: resolvedSerial });
        }
        imported += 1;
      }
    } catch (error) {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason:
          error instanceof Error
            ? error.message
            : "Failed to create contact",
      });
    }
  }

  if (imported > 0 || updated > 0) {
    await writeAuditLog({
      entityType: "contact",
      entityId: "bulk_import",
      action: "imported",
      changes: [
        { field: "imported", old: null, new: imported },
        { field: "updated", old: null, new: updated },
        { field: "duplicateMode", old: null, new: duplicateMode },
      ],
      userId,
    });
  }

  revalidatePath("/[locale]/crm/contacts", "page");

  return NextResponse.json({
    imported,
    updated,
    failed: failures.length,
    failures,
  });
}
