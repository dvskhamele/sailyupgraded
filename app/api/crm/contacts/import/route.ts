import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import { normalizeContactRole } from "@/lib/contact-options";
import { pickSupportedModelFields } from "@/lib/prisma-model-fields";
import { prismadb } from "@/lib/prisma";

type RawRow = Record<string, string>;
type ColumnMapping = {
  name?: string;
  email?: string;
  phone?: string;
};

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

  if (!mapping.name) {
    return NextResponse.json(
      { error: "Name mapping is required" },
      { status: 400 },
    );
  }

  if (!mapping.email && !mapping.phone) {
    return NextResponse.json(
      { error: "At least one of email or phone mapping is required" },
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
    name: string;
    normalizedPhone: string;
  }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = mapping.email ? String(row[mapping.email] ?? "").trim() : "";
    const normalizedEmail = email ? normalizeEmail(email) : "";
    const name = String(row[mapping.name || ""] ?? "").trim();
    const phone = mapping.phone ? String(row[mapping.phone] ?? "").trim() : "";
    const normalizedPhone = phone ? normalizePhone(phone) : "";

    if (!name) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because name is empty",
      });
      return;
    }

    if (!normalizedEmail && !normalizedPhone) {
      failures.push({
        row: rowNumber,
        email: null,
        reason: "Skipped because both email and phone are empty",
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

    if (normalizedPhone && normalizedPhone.replace(/\D/g, "").length < 7) {
      failures.push({
        row: rowNumber,
        email: normalizedEmail || null,
        reason: "Skipped because phone format is invalid",
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

    if (normalizedPhone && seenPhones.has(normalizedPhone)) {
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
    if (normalizedPhone) {
      seenPhones.add(normalizedPhone);
    }
    candidates.push({
      row: rowNumber,
      normalizedEmail,
      name,
      normalizedPhone,
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
              .map((candidate) => candidate.normalizedPhone)
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
      ],
    },
    select: {
      id: true,
      email: true,
      mobile_phone: true,
      office_phone: true,
    },
  });

  const existingByEmail = new Map<string, { id: string }>();
  const existingByPhone = new Map<string, { id: string }>();

  existingContacts.forEach((contact) => {
    const normalizedEmail = contact.email ? normalizeEmail(contact.email) : "";
    const mobilePhone = contact.mobile_phone
      ? normalizePhone(contact.mobile_phone)
      : "";
    const officePhone = contact.office_phone
      ? normalizePhone(contact.office_phone)
      : "";

    if (normalizedEmail) {
      existingByEmail.set(normalizedEmail, { id: contact.id });
    }
    if (mobilePhone) {
      existingByPhone.set(mobilePhone, { id: contact.id });
    }
    if (officePhone) {
      existingByPhone.set(officePhone, { id: contact.id });
    }
  });

  let imported = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existingMatch =
      (candidate.normalizedEmail
        ? existingByEmail.get(candidate.normalizedEmail)
        : undefined) ||
      (candidate.normalizedPhone
        ? existingByPhone.get(candidate.normalizedPhone)
        : undefined);

    if (existingMatch && duplicateMode === "skip") {
      failures.push({
        row: candidate.row,
        email: candidate.normalizedEmail || null,
        reason: "Existing contact matched by email or phone",
      });
      continue;
    }

    const { first_name, last_name } = splitFullName(
      candidate.name,
      candidate.normalizedEmail || candidate.normalizedPhone || candidate.name,
    );

    try {
      if (existingMatch) {
        await prismadb.crm_Contacts.update({
          where: { id: existingMatch.id },
          data: {
            updatedBy: userId,
            first_name: first_name || undefined,
            last_name,
            email: candidate.normalizedEmail || undefined,
            mobile_phone: candidate.normalizedPhone || undefined,
          } as any,
        });
        updated += 1;
      } else {
        const created = await prismadb.crm_Contacts.create({
          data: {
            v: 1,
            createdBy: userId,
            updatedBy: userId,
            first_name: first_name || undefined,
            last_name,
            email: candidate.normalizedEmail || undefined,
            mobile_phone: candidate.normalizedPhone || undefined,
            status: true,
            ...pickSupportedModelFields("crm_Contacts", {
              role: normalizeContactRole("Customer"),
            }),
            tags: [],
            notes: [],
          } as any,
        });

        if (candidate.normalizedEmail) {
          existingByEmail.set(candidate.normalizedEmail, { id: created.id });
        }
        if (candidate.normalizedPhone) {
          existingByPhone.set(candidate.normalizedPhone, { id: created.id });
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
