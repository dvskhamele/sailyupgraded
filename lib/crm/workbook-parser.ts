/**
 * Shared workbook parser for both Contact and Opportunity imports.
 * Reusable across all import types to avoid code duplication.
 */
import * as XLSX from "xlsx";

export type ImportRawRow = Record<string, string>;

export const SOURCE_SHEET_HEADER = "Source Sheet";

function normalizeRawRow(row: ImportRawRow): ImportRawRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      String(value ?? "").trim(),
    ]),
  );
}

function hasImportableValue(row: ImportRawRow) {
  return Object.values(row).some(
    (value) => String(value ?? "").trim().length > 0,
  );
}

/**
 * Parse a workbook (Excel/CSV) and return headers and rows.
 * Supports multiple sheets - if more than one sheet exists,
 * adds a "Source Sheet" column to track origin.
 */
export function parseWorkbookRows(workbook: XLSX.WorkBook) {
  const headers: string[] = [];
  const seenHeaders = new Set<string>();
  const parsedRows: ImportRawRow[] = [];
  const includeSheetName = workbook.SheetNames.length > 1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const sheetRows = XLSX.utils.sheet_to_json<ImportRawRow>(sheet, {
      blankrows: false,
      defval: "",
      raw: false,
    });

    for (const rawRow of sheetRows) {
      if (!hasImportableValue(rawRow)) continue;

      const normalizedRow = normalizeRawRow(rawRow);
      const row = includeSheetName
        ? { ...normalizedRow, [SOURCE_SHEET_HEADER]: sheetName }
        : normalizedRow;

      for (const header of Object.keys(row)) {
        if (!seenHeaders.has(header)) {
          seenHeaders.add(header);
          headers.push(header);
        }
      }

      parsedRows.push(row);
    }
  }

  return { headers, rows: parsedRows };
}