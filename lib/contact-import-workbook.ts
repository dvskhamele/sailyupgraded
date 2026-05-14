import * as XLSX from "xlsx";

export type ContactImportRawRow = Record<string, string>;

export const SOURCE_SHEET_HEADER = "Source Sheet";

function normalizeRawRow(row: ContactImportRawRow): ContactImportRawRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      String(value ?? "").trim(),
    ]),
  );
}

function hasImportableValue(row: ContactImportRawRow) {
  return Object.values(row).some(
    (value) => String(value ?? "").trim().length > 0,
  );
}

export function parseContactWorkbookRows(workbook: XLSX.WorkBook) {
  const nextHeaders: string[] = [];
  const seenHeaders = new Set<string>();
  const parsedRows: ContactImportRawRow[] = [];
  const includeSheetName = workbook.SheetNames.length > 1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const sheetRows = XLSX.utils.sheet_to_json<ContactImportRawRow>(sheet, {
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
          nextHeaders.push(header);
        }
      }

      parsedRows.push(row);
    }
  }

  return { headers: nextHeaders, rows: parsedRows };
}
