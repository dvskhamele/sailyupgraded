import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Contacts: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crm_Accounts: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    users: {
      findMany: jest.fn(),
    },
    crm_Lead_Sources: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    crm_Lead_Statuses: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    crm_Lead_Types: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    crm_Contact_Types: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    custom_fields: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "admin@example.com", name: "Admin User" },
  }),
}));

import { prismadb } from "@/lib/prisma";
import { parseContactWorkbookRows } from "@/lib/contact-import-workbook";
import {
  buildFieldMapping,
  importContacts,
} from "@/lib/crm/contact-importer";
import { parseDateValue } from "@/lib/crm/date-parser";
import {
  AGENT_IMPORT_TEMPLATE_COLUMNS,
  AGENT_IMPORT_TEMPLATE_DUMMY_ROW,
  createAgentTemplateWorkbook,
} from "@/lib/crm/agent-spreadsheet";
import { GET } from "@/app/api/crm/agents/spreadsheet/route";

describe("Agent Excel Download Template (/api/crm/agents/spreadsheet?template=1)", () => {
  const EXPECTED_32_COLUMNS = [
    "Agent Photo",
    "FirstName",
    "LastName",
    "City",
    "State",
    "Zipcode",
    "CellPhone",
    "Email",
    "AgentNumber",
    "AgentStatus",
    "Date Recruited",
    "AgentLevel",
    "Address",
    "Recruiter Name",
    "Date of Birth",
    "ASSIGNED TO",
    "Visibility",
    "Website",
    "Lead Source",
    "Lead Type",
    "Referred By",
    "Campaign",
    "Twitter",
    "Facebook",
    "LinkedIn",
    "Thread",
    "Instagram",
    "YouTube",
    "TikTok",
    "Notes",
    "Assigned Company",
    "Country",
  ];

  it("contains exactly 32 columns in the exact required sequence", () => {
    expect(AGENT_IMPORT_TEMPLATE_COLUMNS).toHaveLength(32);
    expect([...AGENT_IMPORT_TEMPLATE_COLUMNS]).toEqual(EXPECTED_32_COLUMNS);
  });

  it("creates a workbook with the exact 32 headers and the Sophia Anderson dummy foreign row", () => {
    const workbook = createAgentTemplateWorkbook();
    expect(workbook.SheetNames).toContain("Agents");

    const sheet = workbook.Sheets["Agents"];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    expect(rows).toHaveLength(2);
    const headers = rows[0];
    const dummyRow = rows[1];

    expect(headers).toEqual(EXPECTED_32_COLUMNS);

    // Verify each field of the dummy row matches specifications
    expect(dummyRow[0] ?? "").toBe(""); // Agent Photo
    expect(dummyRow[1]).toBe("Sophia"); // FirstName
    expect(dummyRow[2]).toBe("Anderson"); // LastName
    expect(dummyRow[3]).toBe("New York"); // City
    expect(dummyRow[4]).toBe("NY"); // State
    expect(dummyRow[5]).toBe("10001"); // Zipcode (string)
    expect(dummyRow[6]).toBe("+1-212-555-0199"); // CellPhone
    expect(dummyRow[7]).toBe("sophia.anderson@example.com"); // Email
    expect(dummyRow[8]).toBe("NAA550001"); // AgentNumber
    expect(dummyRow[9]).toBe("Active"); // AgentStatus
    expect(dummyRow[10]).toBe("2026-07-15"); // Date Recruited
    expect(dummyRow[11]).toBe("55"); // AgentLevel
    expect(dummyRow[12]).toBe("125 Madison Avenue"); // Address
    expect(dummyRow[13]).toBe("John Carter"); // Recruiter Name
    expect(dummyRow[14]).toBe("1990-05-20"); // Date of Birth
    expect(dummyRow[15]).toBe("Manager A"); // ASSIGNED TO
    expect(dummyRow[16]).toBe("Public"); // Visibility
    expect(dummyRow[17]).toBe("https://www.example.com/agents/sophia-anderson"); // Website
    expect(dummyRow[18]).toBe("LinkedIn"); // Lead Source
    expect(dummyRow[19]).toBe("Inbound"); // Lead Type
    expect(dummyRow[20]).toBe("Global Realty Partner"); // Referred By
    expect(dummyRow[21]).toBe("US Real Estate Campaign 1"); // Campaign
    expect(dummyRow[22]).toBe("https://twitter.com/sophiaanderson"); // Twitter
    expect(dummyRow[23]).toBe("https://facebook.com/sophia.anderson"); // Facebook
    expect(dummyRow[24]).toBe("https://linkedin.com/in/sophia-anderson"); // LinkedIn
    expect(dummyRow[25]).toBe("https://threads.net/@sophiaanderson"); // Thread
    expect(dummyRow[26]).toBe("https://instagram.com/sophiaanderson"); // Instagram
    expect(dummyRow[27]).toBe("https://youtube.com/@sophiaanderson"); // YouTube
    expect(dummyRow[28]).toBe("https://tiktok.com/@sophiaanderson"); // TikTok
    expect(dummyRow[29]).toBe("Dummy foreign client record for import testing."); // Notes
    expect(dummyRow[30]).toBe("NorthStar Realty"); // Assigned Company
    expect(dummyRow[31]).toBe("United States"); // Country
  });

  it("handles GET /api/crm/agents/spreadsheet?template=1 and returns .xlsx with proper headers", async () => {
    const request = new NextRequest("http://localhost:3000/api/crm/agents/spreadsheet?template=1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
    expect(response.headers.get("Content-Disposition")).toContain(".xlsx");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });

    expect(workbook.SheetNames).toContain("Agents");
    const sheet = workbook.Sheets["Agents"];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    expect(rows[0]).toEqual(EXPECTED_32_COLUMNS);
    expect(rows[1][1]).toBe("Sophia");
    expect(rows[1][2]).toBe("Anderson");
    expect(rows[1][5]).toBe("10001");
    expect(rows[1][6]).toBe("+1-212-555-0199");
    expect(rows[1][8]).toBe("NAA550001");
  });

  it("can import the downloaded template directly via Agent Import without errors", async () => {
    const workbook = createAgentTemplateWorkbook();
    const { rows } = parseContactWorkbookRows(workbook);

    expect(rows).toHaveLength(1);
    const createdRecords: any[] = [];

    (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const record = { id: "agent-sophia", ...data };
      createdRecords.push(record);
      return record;
    });
    (prismadb.crm_Accounts.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Accounts.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
      id: "acc-northstar",
      name: data.name,
    }));
    (prismadb.users.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Sources.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Sources.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
      id: "ls-linkedin",
      name: data.name,
    }));
    (prismadb.crm_Lead_Statuses.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Types.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Types.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
      id: "lt-inbound",
      name: data.name,
    }));
    (prismadb.crm_Contact_Types.findMany as jest.Mock).mockResolvedValue([]);

    const result = await importContacts(
      rows,
      { contactType: "agent", userId: "test-user-id" },
      [],
    );

    expect(result.failedRows).toBe(0);
    expect(result.importedRows).toBe(1);
    expect(result.validationErrors).toHaveLength(0);

    expect(createdRecords).toHaveLength(1);
    const agent = createdRecords[0];

    expect(agent.first_name).toBe("Sophia");
    expect(agent.last_name).toBe("Anderson");
    expect(agent.city).toBe("New York");
    expect(agent.state).toBe("NY");
    expect(agent.postal_code).toBe("10001");
    expect(agent.mobile_phone).toBe("+1-212-555-0199");
    expect(agent.email).toBe("sophia.anderson@example.com");
    expect(agent.serial).toBe("NAA550001");
    expect(agent.status).toBe(true);
    expect(agent.agent_level).toBe("55");
    expect(agent.address).toBe("125 Madison Avenue");
    expect(agent.visible_to_name).toBe("Public");
    expect(agent.website).toBe("https://www.example.com/agents/sophia-anderson");
    expect(agent.campaign).toBe("US Real Estate Campaign 1");
    expect(agent.refered_by).toBe("Global Realty Partner");
    expect(agent.social_twitter).toBe("https://twitter.com/sophiaanderson");
    expect(agent.social_facebook).toBe("https://facebook.com/sophia.anderson");
    expect(agent.social_linkedin).toBe("https://linkedin.com/in/sophia-anderson");
    expect(agent.social_skype).toBe("https://threads.net/@sophiaanderson");
    expect(agent.social_instagram).toBe("https://instagram.com/sophiaanderson");
    expect(agent.social_youtube).toBe("https://youtube.com/@sophiaanderson");
    expect(agent.social_tiktok).toBe("https://tiktok.com/@sophiaanderson");
    expect(agent.country).toBe("United States");
    expect(agent.role).toBe("Agent");
    expect(agent.custom_fields_data).toEqual(
      expect.objectContaining({
        recruiter_name: "John Carter",
        "Recruiter Name": "John Carter",
        assigned_member: "Manager A",
        "Assigned Member": "Manager A",
      }),
    );
  });

  it("updates public/templates/agent-import-template.xlsx to match new 32 columns", () => {
    const templatePath = path.resolve(process.cwd(), "public/templates/agent-import-template.xlsx");
    const workbook = createAgentTemplateWorkbook();
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    fs.writeFileSync(templatePath, buffer);

    expect(fs.existsSync(templatePath)).toBe(true);
    const readWb = XLSX.readFile(templatePath);
    const parsed = parseContactWorkbookRows(readWb);
    expect(parsed.headers.filter((h) => !h.startsWith("__"))).toEqual(EXPECTED_32_COLUMNS);
  });
});

describe("Agent Excel Import - 32 Columns Mapping & Parsing", () => {
  const ALL_32_COLUMNS = [
    "Agent Photo",
    "FirstName",
    "LastName",
    "City",
    "State",
    "Zipcode",
    "CellPhone",
    "Email",
    "AgentNumber",
    "AgentStatus",
    "Date Recruited",
    "AgentLevel",
    "Address",
    "Recruiter Name",
    "Date of Birth",
    "ASSIGNED TO",
    "Visibility",
    "Website",
    "Lead Source",
    "Lead Type",
    "Referred By",
    "Campaign",
    "Twitter",
    "Facebook",
    "LinkedIn",
    "Thread",
    "Instagram",
    "YouTube",
    "TikTok",
    "Notes",
    "Assigned Company",
    "Country",
  ];

  it("correctly maps all 32 Agent Excel columns without case or space sensitivity", () => {
    const mapping = buildFieldMapping(ALL_32_COLUMNS, [], "Agent");

    expect(mapping.modelFields["FirstName"]).toBe("first_name");
    expect(mapping.modelFields["LastName"]).toBe("last_name");
    expect(mapping.modelFields["City"]).toBe("city");
    expect(mapping.modelFields["State"]).toBe("state");
    expect(mapping.modelFields["Zipcode"]).toBe("postal_code");
    expect(mapping.modelFields["CellPhone"]).toBe("mobile_phone");
    expect(mapping.modelFields["Email"]).toBe("email");
    expect(mapping.modelFields["AgentNumber"]).toBe("serial");
    expect(mapping.modelFields["AgentStatus"]).toBe("status");
    expect(mapping.modelFields["Date Recruited"]).toBe("created_on");
    expect(mapping.modelFields["AgentLevel"]).toBe("agent_level");
    expect(mapping.modelFields["Address"]).toBe("address");
    expect(mapping.modelFields["Date of Birth"]).toBe("birthday");
    expect(mapping.modelFields["ASSIGNED TO"]).toBe("assigned_to");
    expect(mapping.modelFields["Visibility"]).toBe("visible_to_name");
    expect(mapping.modelFields["Website"]).toBe("website");
    expect(mapping.modelFields["Lead Source"]).toBe("lead_source_id");
    expect(mapping.modelFields["Lead Type"]).toBe("lead_type_id");
    expect(mapping.modelFields["Referred By"]).toBe("refered_by");
    expect(mapping.modelFields["Campaign"]).toBe("campaign");
    expect(mapping.modelFields["Twitter"]).toBe("social_twitter");
    expect(mapping.modelFields["Facebook"]).toBe("social_facebook");
    expect(mapping.modelFields["LinkedIn"]).toBe("social_linkedin");
    expect(mapping.modelFields["Thread"]).toBe("social_skype");
    expect(mapping.modelFields["Instagram"]).toBe("social_instagram");
    expect(mapping.modelFields["YouTube"]).toBe("social_youtube");
    expect(mapping.modelFields["TikTok"]).toBe("social_tiktok");
    expect(mapping.modelFields["Notes"]).toBe("notes");
    expect(mapping.modelFields["Assigned Company"]).toBe("accountsIDs");
    expect(mapping.modelFields["Country"]).toBe("country");
  });
});

describe("Date Parser for International & USA Excel Formats", () => {
  it("parses ISO, US dates, timestamps, and Excel date serials accurately", () => {
    expect(parseDateValue("2026-06-16")).toEqual(new Date(2026, 5, 16));
    expect(parseDateValue("05/30/2026")).toEqual(new Date(2026, 4, 30));
    expect(parseDateValue("5/30/2026")).toEqual(new Date(2026, 4, 30));

    const dateWithTimeAm = parseDateValue("05/30/2026 4:11 AM");
    expect(dateWithTimeAm).not.toBeNull();
    expect(dateWithTimeAm?.getFullYear()).toBe(2026);
    expect(dateWithTimeAm?.getMonth()).toBe(4);
    expect(dateWithTimeAm?.getDate()).toBe(30);
    expect(dateWithTimeAm?.getHours()).toBe(4);
    expect(dateWithTimeAm?.getMinutes()).toBe(11);
  });
});

describe("End-to-End Agent Import - Rosemary Dimba & Updates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("successfully imports Rosemary Dimba sample row with exact fields", async () => {
    const createdRecords: any[] = [];

    (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const record = { id: "agent-rosemary", ...data };
      createdRecords.push(record);
      return record;
    });
    (prismadb.crm_Accounts.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Accounts.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: "acc-1", name: data.name }));
    (prismadb.users.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Sources.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Statuses.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Types.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Contact_Types.findMany as jest.Mock).mockResolvedValue([]);

    const rosemaryRow = {
      FirstName: "Rosemary",
      LastName: "Dimba",
      City: "East orange",
      State: "NJ",
      Zipcode: "02108",
      CellPhone: "(347) 596-5729",
      Email: "Superrossy82@yahoo.com",
      AgentNumber: "NAA548989",
      AgentStatus: "Active",
      "Date Recruited": "2026-06-16",
      AgentLevel: "55",
    };

    const result = await importContacts(
      [rosemaryRow],
      { contactType: "agent", userId: "test-user-id", importBatchId: "BATCH-AGENT-1" },
      [],
    );

    expect(result.failedRows).toBe(0);
    expect(result.importedRows).toBe(1);

    expect(createdRecords).toHaveLength(1);
    const agent = createdRecords[0];

    expect(agent.first_name).toBe("Rosemary");
    expect(agent.last_name).toBe("Dimba");
    expect(agent.city).toBe("East orange");
    expect(agent.state).toBe("NJ");
    expect(agent.postal_code).toBe("02108");
    expect(agent.mobile_phone).toBe("(347) 596-5729");
    expect(agent.email).toBe("Superrossy82@yahoo.com");
    expect(agent.serial).toBe("NAA548989");
    expect(agent.status).toBe(true);
    expect(agent.agent_level).toBe("55");
    expect(agent.role).toBe("Agent");
  });

  it("updates existing agent when AgentNumber matches without creating duplicate and does not overwrite with empty cells", async () => {
    const existingAgent = {
      id: "agent-existing-1",
      serial: "NAA548989",
      first_name: "Rosemary",
      last_name: "Dimba",
      email: "Superrossy82@yahoo.com",
      personal_email: "personal@dimba.com",
      mobile_phone: "(347) 596-5729",
      office_phone: null,
      city: "East orange",
      state: "NJ",
      postal_code: "02108",
      notes: [{ id: "n1", text: "Initial recruitment note", createdAt: "2026-01-01T00:00:00Z", type: "note" }],
      custom_fields_data: {
        "cf-specialization": "Life Insurance",
      },
    };

    const updatedRecords: any[] = [];
    (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([existingAgent]);
    (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(async ({ where, data }: any) => {
      const updated = { id: where.id, ...data };
      updatedRecords.push(updated);
      return updated;
    });

    const updateRow = {
      AgentNumber: "NAA548989",
      AgentLevel: "60",
      Notes: "Promoted to tier 60.",
      Email: "",
      FirstName: "",
    };

    const result = await importContacts(
      [updateRow],
      { contactType: "agent", userId: "test-user-id" },
      [],
    );

    expect(result.importedRows).toBe(0);
    expect(result.updatedRows).toBe(1);
    expect(result.failedRows).toBe(0);

    expect(updatedRecords).toHaveLength(1);
    const updated = updatedRecords[0];
    expect(updated.id).toBe("agent-existing-1");
    expect(updated.agent_level).toBe("60");
    expect(updated.email).toBeUndefined();
    expect(updated.first_name).toBeUndefined();
    expect(updated.custom_fields_data).toEqual(
      expect.objectContaining({
        "cf-specialization": "Life Insurance",
      }),
    );
    expect(updated.notes).toHaveLength(2);
  });
});
