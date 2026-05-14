import * as XLSX from "xlsx";

import {
  SOURCE_SHEET_HEADER,
  parseContactWorkbookRows,
} from "@/lib/contact-import-workbook";

describe("parseContactWorkbookRows", () => {
  it("merges non-empty rows from every workbook sheet", () => {
    const workbook = XLSX.utils.book_new();
    const active = XLSX.utils.aoa_to_sheet([
      ["Full name", "Email"],
      ["Active Contact", "active@example.com"],
      ["", ""],
    ]);
    const inactive = XLSX.utils.aoa_to_sheet([
      ["Full name", "Email"],
      ["Inactive Contact", "inactive@example.com"],
    ]);

    XLSX.utils.book_append_sheet(workbook, active, "ACTIVE");
    XLSX.utils.book_append_sheet(workbook, inactive, "INACTIVE");

    const result = parseContactWorkbookRows(workbook);

    expect(result.headers).toEqual([
      "Full name",
      "Email",
      SOURCE_SHEET_HEADER,
    ]);
    expect(result.rows).toEqual([
      {
        "Full name": "Active Contact",
        Email: "active@example.com",
        [SOURCE_SHEET_HEADER]: "ACTIVE",
      },
      {
        "Full name": "Inactive Contact",
        Email: "inactive@example.com",
        [SOURCE_SHEET_HEADER]: "INACTIVE",
      },
    ]);
  });

  it("parses workbooks above the previous contact import row limit", () => {
    const workbook = XLSX.utils.book_new();
    const rowCount = 501;
    const rows = [
      ["Full name", "Email"],
      ...Array.from({ length: rowCount }, (_, index) => [
        `Contact ${index + 1}`,
        `contact${index + 1}@example.com`,
      ]),
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      "ACTIVE",
    );

    expect(parseContactWorkbookRows(workbook).rows).toHaveLength(rowCount);
  });
});
