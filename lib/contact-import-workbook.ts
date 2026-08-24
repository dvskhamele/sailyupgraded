import * as XLSX from "xlsx";
import {
  extractWorkbookImages,
  type ExtractedExcelImage,
} from "@/lib/crm/excel-image-extractor";

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

function isPhotoHeader(header: string): boolean {
  const norm = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    norm === "agentphoto" ||
    norm === "photo" ||
    norm === "avatar" ||
    norm === "picture" ||
    norm === "image" ||
    norm === "agentimage" ||
    norm === "agentpicture"
  );
}

export function parseContactWorkbookRows(
  workbook: XLSX.WorkBook,
  images?: ExtractedExcelImage[]
) {
  const nextHeaders: string[] = [];
  const seenHeaders = new Set<string>();
  const parsedRows: ContactImportRawRow[] = [];
  const includeSheetName = workbook.SheetNames.length > 1;

  // Build an image lookup: sheetName:row:col or sheetName:row or row
  const imageMap = new Map<string, ExtractedExcelImage>();
  if (Array.isArray(images)) {
    for (const img of images) {
      if (img.sheetName) {
        imageMap.set(`${img.sheetName}:${img.row}:${img.col}`, img);
        imageMap.set(`${img.sheetName}:${img.row}`, img);
      }
      imageMap.set(`${img.row}:${img.col}`, img);
      imageMap.set(`${img.row}`, img);
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Detect header row and column names
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const sheetHeaders: string[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      sheetHeaders.push(cell ? String(cell.v ?? "") : `Column_${C}`);
    }

    const photoColIndex = sheetHeaders.findIndex(isPhotoHeader);
    const photoHeaderName =
      photoColIndex >= 0 ? sheetHeaders[photoColIndex] : "Agent Photo";

    const sheetRows = XLSX.utils.sheet_to_json<ContactImportRawRow>(sheet, {
      blankrows: false,
      defval: "",
      raw: false,
    });

    let rowIndex = range.s.r + 1; // 0-indexed row for data rows (header is range.s.r)

    for (const rawRow of sheetRows) {
      const normalizedRow = normalizeRawRow(rawRow);

      // Check for attached embedded image
      let attachedImage: ExtractedExcelImage | undefined;
      if (photoColIndex >= 0) {
        attachedImage =
          imageMap.get(`${sheetName}:${rowIndex}:${photoColIndex}`) ||
          imageMap.get(`${rowIndex}:${photoColIndex}`);
      }
      if (!attachedImage) {
        attachedImage =
          imageMap.get(`${sheetName}:${rowIndex}:0`) ||
          imageMap.get(`${rowIndex}:0`) ||
          imageMap.get(`${sheetName}:${rowIndex}`) ||
          imageMap.get(`${rowIndex}`);
      }

      if (attachedImage && attachedImage.dataUri) {
        normalizedRow[photoHeaderName] = attachedImage.dataUri;
      }

      if (!hasImportableValue(normalizedRow)) {
        rowIndex++;
        continue;
      }

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
      rowIndex++;
    }
  }

  return { headers: nextHeaders, rows: parsedRows };
}

/**
 * Async version that automatically extracts embedded images from the buffer
 */
export async function parseContactWorkbookBuffer(
  buffer: ArrayBuffer | Buffer,
  options?: XLSX.ParsingOptions
) {
  const workbook = XLSX.read(buffer, {
    type: Buffer.isBuffer(buffer) ? "buffer" : "array",
    raw: false,
    cellDates: false,
    ...options,
  });

  const images = await extractWorkbookImages(buffer);
  return parseContactWorkbookRows(workbook, images);
}
