import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import { prismadb } from "@/lib/prisma";
import {
  importOpportunities,
  type OpportunityImportOptions,
} from "@/lib/crm/opportunity-importer";

/**
 * POST /api/crm/opportunities/import
 *
 * Dynamic, intelligent opportunity import.
 *
 * Request body:
 * {
 *   rows: Record<string, string>[]           // Excel rows (parsed)
 *   mapping?: Record<string, string>          // Optional explicit mapping (manual fallback)
 * }
 *
 * The backend:
 * - Auto-detects all headers
 * - Normalizes headers (ignores spaces, underscores, hyphens, case)
 * - Auto-maps matching fields to the Opportunity model
 * - Stores unknown columns as custom fields
 * - Never fails because of unknown columns
 * - Skips only completely empty rows
 * - Returns detailed import summary
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? body.rows : [];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows provided for import" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const importBatchId = Date.now().toString(36).toUpperCase();

  // Fetch custom field definitions for mapping
  const opportunityCustomFields = await prismadb.custom_fields.findMany({
    orderBy: { createdAt: "asc" },
  });

  try {
    // Use the reusable opportunity import engine
    const result = await importOpportunities(
      rows,
      {
        userId,
        importBatchId,
      } as OpportunityImportOptions,
      opportunityCustomFields,
    );

    // Compile response
    const failures = result.validationErrors.map((err) => ({
      row: err.row,
      name: err.identifier,
      reason: err.reason,
    }));

    // Audit log
    if (result.importedRows > 0) {
      await writeAuditLog({
        entityType: "opportunity",
        entityId: "bulk_import",
        action: "imported",
        changes: [
          { field: "imported", old: null, new: result.importedRows },
          { field: "totalRows", old: null, new: result.totalRows },
        ],
        userId,
      });
    }

    revalidatePath("/[locale]/crm/opportunities", "page");

    // Return enhanced response with full summary
    return NextResponse.json({
      imported: result.importedRows,
      failed: result.failedRows,
      failures,

      // Enhanced summary
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
    console.error("[OPPORTUNITY IMPORT ERROR]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed unexpectedly",
        imported: 0,
        failed: 1,
        failures: [
          {
            row: 0,
            name: null,
            reason: error instanceof Error ? error.message : "Import failed unexpectedly",
          },
        ],
      },
      { status: 500 },
    );
  }
}