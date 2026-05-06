import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import {
  detectContactRole,
  inferContactRoleFromIdentifierContext,
  normalizeContactRole,
} from "@/lib/contact-options";
import type { MappingKey } from "@/lib/crm/contact-import";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { prismadb } from "@/lib/prisma";

type RawRow = Record<string, string>;
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

function parseSerial(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

function maybeSetTextField<T extends string>(
  payload: Record<string, unknown>,
  key: string,
  value: T | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
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
    body?.duplicateMode === "skip" ? "skip" : "update";

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
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const failures: Array<{ row: number; email: string | null; reason: string }> = [];
  const candidates: Array<{
    row: number;
    normalizedEmail: string;
    normalizedMobilePhone: string;
    normalizedOfficePhone: string;
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
      email: true,
      mobile_phone: true,
      office_phone: true,
      first_name: true,
      last_name: true,
      personal_email: true,
      website: true,
      position: true,
      description: true,
      birthday: true,
      address: true,
      address_line1: true,
      address_line2: true,
      city: true,
      state: true,
      country: true,
      postal_code: true,
      status: true,
      role: true,
      assigned_to: true,
      accountsIDs: true,
      contact_type_id: true,
      company: true,
      social_twitter: true,
      social_facebook: true,
      social_linkedin: true,
      social_skype: true,
      social_youtube: true,
      social_tiktok: true,
    },
  });

  const existingByEmail = new Map<string, (typeof existingContacts)[number]>();
  const existingByPhone = new Map<string, (typeof existingContacts)[number]>();

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
    if (user.email) {
      userLookup.set(user.email, user.id);
      userLookup.set(normalizeLookupKey(user.email), user.id);
    }
    if (user.name) {
      userLookup.set(user.name, user.id);
      userLookup.set(normalizeLookupKey(user.name), user.id);
    }
  });
  accounts.forEach((account) => {
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(normalizeLookupKey(account.name), account.id);
  });
  contactTypes.forEach((contactType) => {
    contactTypeLookup.set(contactType.id, contactType.id);
    contactTypeLookup.set(contactType.name, contactType.id);
    contactTypeLookup.set(normalizeLookupKey(contactType.name), contactType.id);
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
      existingByEmail.set(normalizedEmail, contact);
    }
    if (mobilePhone) {
      existingByPhone.set(mobilePhone, contact);
    }
    if (officePhone) {
      existingByPhone.set(officePhone, contact);
    }
  });

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
    const resolvedAssignedTo = assignedToRaw
      ? userLookup.get(assignedToRaw) ?? userLookup.get(normalizeLookupKey(assignedToRaw))
      : undefined;
    const resolvedAssignedAccount = assignedAccountRaw
      ? accountLookup.get(assignedAccountRaw) ??
        accountLookup.get(normalizeLookupKey(assignedAccountRaw))
      : undefined;
    const resolvedContactType = contactTypeRaw
      ? contactTypeLookup.get(contactTypeRaw) ??
        contactTypeLookup.get(normalizeLookupKey(contactTypeRaw))
      : undefined;

    const serial = parseSerial(candidate.data.serial || "");
    const parsedStatus = parseStatus(candidate.data.status || "");
    const inferredRoleFromIdentifier = inferContactRoleFromIdentifierContext(
      mapping.serial,
      mapping.role,
      candidate.data.role,
    );
    const resolvedRole =
      detectContactRole(candidate.data.role) ??
      inferredRoleFromIdentifier;

    if (!resolvedRole && !existingMatch) {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason: "Role could not be detected. Add a Role column or use a role-specific ID header like AgentNumber or CustomerID.",
      });
      continue;
    }

    const supportedSerialField =
      serial !== undefined
        ? await pickExistingDbModelFields("crm_Contacts", {
            serial,
          })
        : {};

    const roleField =
      resolvedRole !== undefined
        ? await pickExistingDbModelFields("crm_Contacts", {
            role: normalizeContactRole(resolvedRole),
          })
        : {};

    const contactPayload: Record<string, unknown> = {
      ...supportedSerialField,
      ...roleField,
      last_name,
    };

    maybeSetTextField(contactPayload, "first_name", first_name || undefined);
    maybeSetTextField(contactPayload, "email", candidate.normalizedEmail || undefined);
    maybeSetTextField(
      contactPayload,
      "personal_email",
      normalizeOptionalText(candidate.data.personal_email),
    );
    maybeSetTextField(contactPayload, "mobile_phone", candidate.normalizedMobilePhone || undefined);
    maybeSetTextField(contactPayload, "office_phone", candidate.normalizedOfficePhone || undefined);
    maybeSetTextField(contactPayload, "website", normalizeOptionalText(candidate.data.website));
    maybeSetTextField(contactPayload, "position", normalizeOptionalText(candidate.data.position));
    maybeSetTextField(
      contactPayload,
      "description",
      normalizeOptionalText(candidate.data.description),
    );
    maybeSetTextField(contactPayload, "birthday", normalizeOptionalText(candidate.data.birthday));
    maybeSetTextField(contactPayload, "address", normalizeOptionalText(candidate.data.address));
    maybeSetTextField(
      contactPayload,
      "address_line1",
      normalizeOptionalText(candidate.data.address_line1),
    );
    maybeSetTextField(
      contactPayload,
      "address_line2",
      normalizeOptionalText(candidate.data.address_line2),
    );
    maybeSetTextField(contactPayload, "city", normalizeOptionalText(candidate.data.city));
    maybeSetTextField(contactPayload, "state", normalizeOptionalText(candidate.data.state));
    maybeSetTextField(contactPayload, "country", normalizeOptionalText(candidate.data.country));
    maybeSetTextField(
      contactPayload,
      "postal_code",
      normalizeOptionalText(candidate.data.postal_code),
    );
    maybeSetTextField(
      contactPayload,
      "company",
      normalizeOptionalText(candidate.data.assigned_account),
    );
    maybeSetTextField(
      contactPayload,
      "social_twitter",
      normalizeOptionalText(candidate.data.social_twitter),
    );
    maybeSetTextField(
      contactPayload,
      "social_facebook",
      normalizeOptionalText(candidate.data.social_facebook),
    );
    maybeSetTextField(
      contactPayload,
      "social_linkedin",
      normalizeOptionalText(candidate.data.social_linkedin),
    );
    maybeSetTextField(contactPayload, "social_skype", normalizeOptionalText(candidate.data.social_skype));
    maybeSetTextField(
      contactPayload,
      "social_youtube",
      normalizeOptionalText(candidate.data.social_youtube),
    );
    maybeSetTextField(
      contactPayload,
      "social_tiktok",
      normalizeOptionalText(candidate.data.social_tiktok),
    );

    if (parsedStatus !== undefined) {
      contactPayload.status = parsedStatus;
    } else if (!existingMatch) {
      contactPayload.status = true;
    }

    if (resolvedAssignedTo) {
      contactPayload.assigned_to = resolvedAssignedTo;
    }
    if (resolvedAssignedAccount) {
      contactPayload.accountsIDs = resolvedAssignedAccount;
    }
    if (resolvedContactType) {
      contactPayload.contact_type_id = resolvedContactType;
    }

    if (existingMatch) {
      if (!("first_name" in contactPayload) && existingMatch.first_name) {
        delete contactPayload.first_name;
      }

      if (!candidate.data.first_name && !candidate.data.last_name && !candidate.data.name) {
        delete contactPayload.last_name;
      }

      if (!resolvedRole) {
        delete contactPayload.role;
      }
    }

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
            notes: {},
          } as any,
          select: { id: true },
        });

        if (candidate.normalizedEmail) {
          existingByEmail.set(candidate.normalizedEmail, {
            id: created.id,
          } as (typeof existingContacts)[number]);
        }
        if (candidate.normalizedMobilePhone) {
          existingByPhone.set(candidate.normalizedMobilePhone, {
            id: created.id,
          } as (typeof existingContacts)[number]);
        }
        if (candidate.normalizedOfficePhone) {
          existingByPhone.set(candidate.normalizedOfficePhone, {
            id: created.id,
          } as (typeof existingContacts)[number]);
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
