import * as XLSX from "xlsx";

export type ContactImportRawRow = Record<string, string>;

export const MAX_CONTACT_IMPORT_ROWS = 500;
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

function estimateDataRows(sheet: XLSX.WorkSheet) {
  const rangeRef = sheet["!ref"];
  if (!rangeRef) return 0;

  const range = XLSX.utils.decode_range(rangeRef);
  return Math.max(0, range.e.r - range.s.r);
}

export function parseContactWorkbookRows(workbook: XLSX.WorkBook) {
  const nextHeaders: string[] = [];
  const seenHeaders = new Set<string>();
  const parsedRows: ContactImportRawRow[] = [];
  const includeSheetName = workbook.SheetNames.length > 1;
  let estimatedRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    estimatedRows += estimateDataRows(sheet);
    if (estimatedRows > MAX_CONTACT_IMPORT_ROWS) {
      throw new Error(`Import limited to ${MAX_CONTACT_IMPORT_ROWS} rows per file`);
    }

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

      if (parsedRows.length > MAX_CONTACT_IMPORT_ROWS) {
        throw new Error(`Import limited to ${MAX_CONTACT_IMPORT_ROWS} rows per file`);
      }
    }
  }

  return { headers: nextHeaders, rows: parsedRows };
}
