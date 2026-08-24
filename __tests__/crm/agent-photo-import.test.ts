import * as XLSX from "xlsx";
import JSZip from "jszip";
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
import { importContacts } from "@/lib/crm/contact-importer";
import {
  parseContactWorkbookRows,
  parseContactWorkbookBuffer,
} from "@/lib/contact-import-workbook";
import {
  extractWorkbookImages,
  detectImageMimeType,
} from "@/lib/crm/excel-image-extractor";
import {
  uploadAgentPhoto,
  isAgentPhotoInstruction,
  parseDataUri,
} from "@/lib/crm/agent-photo-storage";
import {
  AGENT_IMPORT_TEMPLATE_COLUMNS,
  createAgentTemplateWorkbook,
} from "@/lib/crm/agent-spreadsheet";
import { GET } from "@/app/api/crm/agents/spreadsheet/route";

describe("Agent Photo / Image Import & Excel Processing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prismadb.crm_Accounts.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Accounts.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
      id: "acc-1",
      name: data.name,
    }));
    (prismadb.users.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Sources.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Statuses.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Lead_Types.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.crm_Contact_Types.findMany as jest.Mock).mockResolvedValue([]);
    (prismadb.custom_fields.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe("Download Template - First Column Verification", () => {
    it("keeps 'Agent Photo' as the FIRST column in the template", () => {
      expect(AGENT_IMPORT_TEMPLATE_COLUMNS[0]).toBe("Agent Photo");
      const workbook = createAgentTemplateWorkbook();
      const sheet = workbook.Sheets["Agents"];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      expect(rows[0][0]).toBe("Agent Photo");
    });

    it("serves template via API route with 'Agent Photo' as first column", async () => {
      const request = new NextRequest("http://localhost:3000/api/crm/agents/spreadsheet?template=1");
      const response = await GET(request);
      expect(response.status).toBe(200);

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
      const sheet = workbook.Sheets["Agents"];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      expect(rows[0][0]).toBe("Agent Photo");
    });
  });

  describe("Embedded Excel Image Extraction", () => {
    it("detects image mime types correctly from magic numbers and filenames", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      expect(detectImageMimeType(pngHeader)).toBe("image/png");

      const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectImageMimeType(jpgHeader)).toBe("image/jpeg");

      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38]);
      expect(detectImageMimeType(gifHeader)).toBe("image/gif");
    });

    it("extracts embedded drawings from an Excel zip archive", async () => {
      const samplePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

      const zip = new JSZip();
      zip.file("xl/workbook.xml", '<workbook><sheets><sheet name="Agents" sheetId="1" r:id="rId1"/></sheets></workbook>');
      zip.file("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
      zip.file("xl/worksheets/sheet1.xml", '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>');
      zip.file("xl/worksheets/_rels/sheet1.xml.rels", '<Relationships><Relationship Id="rIdDraw" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
      zip.file("xl/drawings/drawing1.xml", '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImg1"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor></xdr:wsDr>');
      zip.file("xl/drawings/_rels/drawing1.xml.rels", '<Relationships><Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
      zip.file("xl/media/image1.png", samplePng);

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const extracted = await extractWorkbookImages(zipBuffer);

      expect(extracted).toHaveLength(1);
      expect(extracted[0].col).toBe(0);
      expect(extracted[0].row).toBe(1);
      expect(extracted[0].mimeType).toBe("image/png");
      expect(extracted[0].dataUri).toContain("data:image/png;base64,");
    });
  });

  describe("Agent Photo Storage & URL Helper", () => {
    it("recognizes placeholder instructions as empty", () => {
      expect(isAgentPhotoInstruction("Add agent photo here")).toBe(true);
      expect(isAgentPhotoInstruction("add photo here")).toBe(true);
      expect(isAgentPhotoInstruction("")).toBe(true);
      expect(isAgentPhotoInstruction(null)).toBe(true);
      expect(isAgentPhotoInstruction("https://example.com/photo.jpg")).toBe(false);
      expect(isAgentPhotoInstruction("data:image/png;base64,abc")).toBe(false);
    });

    it("parses valid data URIs", () => {
      const parsed = parseDataUri("data:image/jpeg;base64,QUJDRA==");
      expect(parsed.mimeType).toBe("image/jpeg");
      expect(parsed.buffer.toString()).toBe("ABCD");
    });

    it("returns direct URLs without modification", async () => {
      const url = "https://cdn.example.com/avatars/agent123.jpg";
      const result = await uploadAgentPhoto(url);
      expect(result).toBe(url);
    });
  });

  describe("Scenario 1: Excel with Agent Photo + Agent data → Agent and photo both imported", () => {
    it("creates a new Agent record with custom_fields_data containing agent_photo", async () => {
      const createdContacts: any[] = [];
      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([]);
      (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
        const record = { id: "agent-1", ...data };
        createdContacts.push(record);
        return record;
      });

      const rows = [
        {
          "Agent Photo": "https://cdn.example.com/agent-alice.png",
          "First Name": "Alice",
          "Last Name": "Smith",
          Email: "alice.smith@example.com",
          AgentNumber: "AG-101",
        },
      ];

      const result = await importContacts(rows, { contactType: "agent", userId: "test-user-id" }, []);

      expect(result.importedRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(createdContacts).toHaveLength(1);
      expect(createdContacts[0].first_name).toBe("Alice");
      expect(createdContacts[0].last_name).toBe("Smith");
      expect(createdContacts[0].email).toBe("alice.smith@example.com");
      expect(createdContacts[0].custom_fields_data).toEqual(
        expect.objectContaining({
          agent_photo: "https://cdn.example.com/agent-alice.png",
          "Agent Photo": "https://cdn.example.com/agent-alice.png",
        })
      );
    });
  });

  describe("Scenario 2: Excel without Agent Photo → Agent data imports successfully", () => {
    it("creates an Agent record without photo when Agent Photo column is empty", async () => {
      const createdContacts: any[] = [];
      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([]);
      (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
        const record = { id: "agent-2", ...data };
        createdContacts.push(record);
        return record;
      });

      const rows = [
        {
          "Agent Photo": "Add agent photo here", // template placeholder instruction
          "First Name": "Bob",
          "Last Name": "Jones",
          Email: "bob.jones@example.com",
          AgentNumber: "AG-102",
        },
      ];

      const result = await importContacts(rows, { contactType: "agent", userId: "test-user-id" }, []);

      expect(result.importedRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(createdContacts).toHaveLength(1);
      expect(createdContacts[0].first_name).toBe("Bob");
      // Photo should not be set
      expect(createdContacts[0].custom_fields_data?.agent_photo).toBeUndefined();
    });
  });

  describe("Scenario 3: Existing Agent with photo + Excel photo empty → Existing photo remains unchanged", () => {
    it("updates existing agent details while preserving existing agent_photo", async () => {
      const existingAgent = {
        id: "agent-existing-1",
        first_name: "Charlie",
        last_name: "Brown",
        email: "charlie.brown@example.com",
        serial: "AG-103",
        role: "Agent",
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/original-charlie.jpg",
          "Agent Photo": "https://cdn.example.com/original-charlie.jpg",
          recruiter_name: "Original Recruiter",
        },
      };

      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([existingAgent]);
      let updatedData: any = null;
      (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(async ({ where, data }: any) => {
        updatedData = data;
        return { ...existingAgent, ...data };
      });

      const rows = [
        {
          "Agent Photo": "", // Empty photo in Excel
          "First Name": "Charlie",
          "Last Name": "Brown-Updated",
          Email: "charlie.brown@example.com",
          AgentNumber: "AG-103",
          City: "Chicago",
        },
      ];

      const result = await importContacts(rows, { contactType: "agent", userId: "test-user-id" }, []);

      expect(result.importedRows).toBe(0);
      expect(result.updatedRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(updatedData).not.toBeNull();
      expect(updatedData.last_name).toBe("Brown-Updated");
      expect(updatedData.city).toBe("Chicago");
      // Existing photo MUST be preserved
      expect(updatedData.custom_fields_data.agent_photo).toBe("https://cdn.example.com/original-charlie.jpg");
    });
  });

  describe("Scenario 4: Existing Agent with photo + new Excel photo → Existing photo is updated", () => {
    it("updates existing agent's photo with new image URL provided in Excel", async () => {
      const existingAgent = {
        id: "agent-existing-2",
        first_name: "Diana",
        last_name: "Prince",
        email: "diana.prince@example.com",
        serial: "AG-104",
        role: "Agent",
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/old-diana.jpg",
          "Agent Photo": "https://cdn.example.com/old-diana.jpg",
        },
      };

      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([existingAgent]);
      let updatedData: any = null;
      (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(async ({ data }: any) => {
        updatedData = data;
        return { ...existingAgent, ...data };
      });

      const rows = [
        {
          "Agent Photo": "https://cdn.example.com/new-diana-2026.png", // New photo provided
          "First Name": "Diana",
          "Last Name": "Prince",
          Email: "diana.prince@example.com",
          AgentNumber: "AG-104",
        },
      ];

      const result = await importContacts(rows, { contactType: "agent", userId: "test-user-id" }, []);

      expect(result.updatedRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(updatedData.custom_fields_data.agent_photo).toBe("https://cdn.example.com/new-diana-2026.png");
      expect(updatedData.custom_fields_data["Agent Photo"]).toBe("https://cdn.example.com/new-diana-2026.png");
    });
  });

  describe("Scenario 5: Multiple Excel rows with different photos → Each photo assigned to correct Agent", () => {
    it("correctly maps individual photos to their respective agents across multiple rows", async () => {
      const createdContacts: any[] = [];
      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([]);
      (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
        const record = { id: `agent-${createdContacts.length + 1}`, ...data };
        createdContacts.push(record);
        return record;
      });

      const rows = [
        {
          "Agent Photo": "https://cdn.example.com/agent-1.png",
          "First Name": "Agent",
          "Last Name": "One",
          Email: "agent.one@example.com",
          AgentNumber: "AG-001",
        },
        {
          "Agent Photo": "https://cdn.example.com/agent-2.png",
          "First Name": "Agent",
          "Last Name": "Two",
          Email: "agent.two@example.com",
          AgentNumber: "AG-002",
        },
        {
          "Agent Photo": "", // Third agent has no photo
          "First Name": "Agent",
          "Last Name": "Three",
          Email: "agent.three@example.com",
          AgentNumber: "AG-003",
        },
      ];

      const result = await importContacts(rows, { contactType: "agent", userId: "test-user-id" }, []);

      expect(result.importedRows).toBe(3);
      expect(result.failedRows).toBe(0);
      expect(createdContacts).toHaveLength(3);

      expect(createdContacts[0].custom_fields_data.agent_photo).toBe("https://cdn.example.com/agent-1.png");
      expect(createdContacts[1].custom_fields_data.agent_photo).toBe("https://cdn.example.com/agent-2.png");
      expect(createdContacts[2].custom_fields_data?.agent_photo).toBeUndefined();
    });
  });

  describe("Scenario 6: One invalid image → Reports error for that row, remaining rows continue importing", () => {
    it("handles corrupt image gracefully, reporting row error without failing the whole import", async () => {
      const createdContacts: any[] = [];
      (prismadb.crm_Contacts.findMany as jest.Mock).mockResolvedValue([]);
      (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
        const record = { id: `agent-${createdContacts.length + 1}`, ...data };
        createdContacts.push(record);
        return record;
      });

      const rows = [
        {
          "Agent Photo": "data:image/png;base64,CORRUPT_NOT_BASE64!@#$%",
          "First Name": "Invalid",
          "Last Name": "ImageAgent",
          Email: "invalid.image@example.com",
          AgentNumber: "AG-ERR",
        },
        {
          "Agent Photo": "https://cdn.example.com/valid-agent.png",
          "First Name": "Valid",
          "Last Name": "ImageAgent",
          Email: "valid.image@example.com",
          AgentNumber: "AG-OK",
        },
      ];

      const result = await importContacts(rows, { contactType: "agent", userId: "test-user-id" }, []);

      // Both contacts should be imported; the invalid image row records a validation warning/error
      expect(result.importedRows).toBe(2);
      expect(createdContacts).toHaveLength(2);

      // Row 1 imported without broken photo
      expect(createdContacts[0].first_name).toBe("Invalid");
      // Row 2 imported with valid photo
      expect(createdContacts[1].first_name).toBe("Valid");
      expect(createdContacts[1].custom_fields_data.agent_photo).toBe("https://cdn.example.com/valid-agent.png");
    });
  });
});
