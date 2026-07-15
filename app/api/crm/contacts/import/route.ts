import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import { prismadb } from "@/lib/prisma";
import {
  importContacts,
  type ContactImportSummary,
  type ContactImportContactType,
} from "@/lib/crm/contact-importer";

/**
 * POST /api/crm/contacts/import
 *
 * Page-aware, dynamic contact import.
 *
 * Request body:
 * {
 *   rows: Record<string, string>[]           // Excel rows (parsed)
 *   contactType: string                       // REQUIRED: page context (customer/agent/prospect/vendor/etc.)
 *   mapping?: Record<string, string>          // Legacy optional explicit mapping
 * }
 *
 * The backend NEVER guesses the contact type from Excel data.
 * contactType MUST be provided by the frontend based on which page the user is on.
 * Duplicate records are always allowed — no duplicate detection is performed.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const contactType = (body?.contactType || body?.importRole || "").toLowerCase().trim();

  // Validate contactType is provided
  if (!contactType) {
    return NextResponse.json(
      { error: "contactType is required. The page context (customer, agent, prospect, vendor, etc.) must be sent from the frontend." },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows provided for import" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const importBatchId = Date.now().toString(36).toUpperCase();

  // Fetch custom field definitions for mapping
  const contactCustomFields = await prismadb.custom_fields.findMany({
    orderBy: { createdAt: "asc" },
  });

  try {
    // Use the generic, reusable import engine
    const result: ContactImportSummary = await importContacts(
      rows,
      {
        contactType: contactType as ContactImportContactType,
        userId,
        importBatchId,
      },
      contactCustomFields,
    );

    // Compile response - preserve backwards compatibility with legacy import response shape
    const failures = result.validationErrors.map((err) => ({
      row: err.row,
      email: err.email,
      reason: err.reason,
    }));

    // Audit log
    if (result.importedRows > 0) {
      await writeAuditLog({
        entityType: "contact",
        entityId: "bulk_import",
        action: "imported",
        changes: [
          { field: "imported", old: null, new: result.importedRows },
          { field: "totalRows", old: null, new: result.totalRows },
          { field: "contactType", old: null, new: contactType },
        ],
        userId,
      });
    }

    revalidatePath("/[locale]/crm/contacts", "page");

    // Return enhanced response with full summary (backward-compatible + new fields)
    return NextResponse.json({
      imported: result.importedRows,
      updated: 0,
      failed: result.validationErrors.length,
      failures,

      // New enhanced summary fields
      summary: {
        totalRows: result.totalRows,
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        validationErrors: failures,
        mappedFields: result.mappedFields,
        customFields: result.customFields,
      },
    });
  } catch (error) {
    console.error("[CONTACT IMPORT ERROR]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed unexpectedly",
        imported: 0,
        updated: 0,
        failed: 1,
        failures: [
          {
            row: 0,
            email: null,
            reason: error instanceof Error ? error.message : "Import failed unexpectedly",
          },
        ],
      },
      { status: 500 },
    );
  }
}
