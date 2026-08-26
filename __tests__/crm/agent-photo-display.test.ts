import {
  extractAgentPhotoUrl,
  getAgentInitials,
} from "@/lib/crm/agent-photo";
import {
  validateAgentPhotoFile,
  isValidImageBuffer,
  isAgentPhotoInstruction,
  MAX_AGENT_PHOTO_SIZE_BYTES,
} from "@/lib/crm/agent-photo-storage";
import { BasicView } from "@/app/[locale]/(routes)/crm/contacts/[contactId]/components/BasicView";
import { createContact } from "@/actions/crm/contacts/create-contact";
import { updateContact } from "@/actions/crm/contacts/update-contact";
import {
  updateContactPhoto,
  removeContactPhoto,
} from "@/actions/crm/contacts/update-contact-photo";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Contacts: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crm_Accounts: {
      findMany: jest.fn(),
    },
    users: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    crm_Lead_Sources: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    crm_Lead_Statuses: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    crm_Lead_Types: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    crm_Contact_Types: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    crm_Opportunities_Sales_Stages: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    crm_Products: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    crm_Opportunities: {
      create: jest.fn(),
      update: jest.fn(),
    },
    custom_fields: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((callback) => callback(prismadb)),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  },
  withPrismaRetry: jest.fn((fn) => fn()),
  getDatabaseUrlDiagnostics: jest.fn(),
}));

jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "user-123", email: "admin@example.com", name: "Admin" },
  }),
}));

jest.mock("@/actions/crm/get-crm-data", () => ({
  getAllCrmData: jest.fn().mockResolvedValue({
    accounts: [],
    contactTypes: [],
    leadSources: [],
    leadStatuses: [],
    leadTypes: [],
    saleStages: [],
    products: [],
  }),
}));

jest.mock("@/lib/audit-log", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
  diffObjects: jest.fn().mockReturnValue(null),
}));

jest.mock("@/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/sendmail", () => jest.fn().mockResolvedValue(undefined));

describe("Agent / Contact Photo Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. extractAgentPhotoUrl & getAgentInitials", () => {
    it("extracts photo from custom_fields_data.agent_photo", () => {
      const data = {
        first_name: "Sophia",
        last_name: "Anderson",
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/sophia.jpg",
        },
      };
      expect(extractAgentPhotoUrl(data)).toBe("https://cdn.example.com/sophia.jpg");
    });

    it("extracts photo from custom_fields_data['Agent Photo']", () => {
      const data = {
        first_name: "Sophia",
        last_name: "Anderson",
        custom_fields_data: {
          "Agent Photo": "https://cdn.example.com/sophia-alt.png",
        },
      };
      expect(extractAgentPhotoUrl(data)).toBe("https://cdn.example.com/sophia-alt.png");
    });

    it("extracts photo from direct agent_photo, photo, or avatar fields", () => {
      expect(extractAgentPhotoUrl({ agent_photo: "https://cdn.example.com/direct-agent.png" })).toBe("https://cdn.example.com/direct-agent.png");
      expect(extractAgentPhotoUrl({ photo: "https://cdn.example.com/photo.png" })).toBe("https://cdn.example.com/photo.png");
      expect(extractAgentPhotoUrl({ avatar: "https://cdn.example.com/avatar.png" })).toBe("https://cdn.example.com/avatar.png");
    });

    it("extracts photo from custom_fields_data file object", () => {
      const data = {
        custom_fields_data: {
          field_123: {
            url: "https://cdn.example.com/uploaded-file.jpg",
            name: "avatar.jpg",
            size: 1024,
            type: "image/jpeg",
          },
        },
      };
      expect(extractAgentPhotoUrl(data)).toBe("https://cdn.example.com/uploaded-file.jpg");
    });

    it("extracts data URI photo", () => {
      const dataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const data = {
        custom_fields_data: {
          agent_photo: dataUri,
        },
      };
      expect(extractAgentPhotoUrl(data)).toBe(dataUri);
    });

    it("filters out placeholder instruction text (e.g. 'Add agent photo here', 'Insert agent photo here', 'n/a')", () => {
      expect(extractAgentPhotoUrl({ custom_fields_data: { agent_photo: "Add agent photo here" } })).toBeNull();
      expect(extractAgentPhotoUrl({ custom_fields_data: { agent_photo: "Insert agent photo here" } })).toBeNull();
      expect(extractAgentPhotoUrl({ custom_fields_data: { agent_photo: "none" } })).toBeNull();
      expect(extractAgentPhotoUrl({ custom_fields_data: { agent_photo: "" } })).toBeNull();
      expect(extractAgentPhotoUrl({ custom_fields_data: null })).toBeNull();
    });

    it("returns correct uppercase initials for fallback avatar", () => {
      expect(getAgentInitials({ first_name: "Sophia", last_name: "Anderson" })).toBe("SA");
      expect(getAgentInitials({ first_name: "Sophia", last_name: "" })).toBe("S");
      expect(getAgentInitials({ first_name: "", last_name: "Anderson" })).toBe("A");
      expect(getAgentInitials({ name: "Sophia Anderson" })).toBe("SA");
      expect(getAgentInitials({ email: "sophia@example.com" })).toBe("S");
      expect(getAgentInitials({})).toBe("?");
    });
  });

  describe("2. Image Validation & Error Handling", () => {
    it("validates valid JPG, PNG, WEBP, and GIF buffers", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(isValidImageBuffer(pngHeader)).toBe(true);

      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(isValidImageBuffer(jpegHeader)).toBe(true);

      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(isValidImageBuffer(gifHeader)).toBe(true);

      const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      expect(isValidImageBuffer(webpHeader)).toBe(true);
    });

    it("rejects non-image files such as PDF or text", () => {
      const pdfHeader = Buffer.from("%PDF-1.4 file content", "utf8");
      expect(isValidImageBuffer(pdfHeader)).toBe(false);

      const validation = validateAgentPhotoFile({
        name: "document.pdf",
        size: 1024,
        type: "application/pdf",
        buffer: pdfHeader,
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe("Please upload a valid image file.");
    });

    it("rejects files exceeding maximum size limit", () => {
      const validation = validateAgentPhotoFile({
        name: "huge_photo.jpg",
        size: MAX_AGENT_PHOTO_SIZE_BYTES + 1024,
        type: "image/jpeg",
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe("Image is too large. Please upload a smaller image.");
    });
  });

  describe("3. Create Agent with / without photo", () => {
    it("Test 1: Create Agent without photo -> fallback initials available", async () => {
      (prismadb.crm_Contacts.create as jest.Mock).mockResolvedValue({
        id: "agent-no-photo",
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        custom_fields_data: null,
      });

      const result = await createContact({
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
      } as any);

      expect(result.data).toBeDefined();
      expect(extractAgentPhotoUrl(result.data)).toBeNull();
      expect(getAgentInitials(result.data)).toBe("SA");
    });

    it("Test 2: Create Agent with photo -> photo saved in custom_fields_data", async () => {
      let createdData: any = null;
      (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(async ({ data }: any) => {
        createdData = data;
        return {
          id: "agent-with-photo",
          ...data,
        };
      });

      const payload = {
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/sophia-profile.jpg",
        },
      };

      const result = await createContact(payload as any);
      expect(result.data).toBeDefined();
      expect(createdData.custom_fields_data).toEqual(
        expect.objectContaining({
          agent_photo: "https://cdn.example.com/sophia-profile.jpg",
        })
      );
      expect(extractAgentPhotoUrl(result.data)).toBe("https://cdn.example.com/sophia-profile.jpg");
    });
  });

  describe("4. Detail Page Direct Photo Upload & Change", () => {
    it("Test 3 & 4: Upload / change photo updates DB reference and preserves other fields", async () => {
      const existingAgent = {
        id: "agent-detail-123",
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        city: "New York",
        custom_fields_data: {
          recruiter_name: "Senior Recruiter",
          agent_photo: "https://cdn.example.com/old-photo.jpg",
        },
      };

      (prismadb.crm_Contacts.findFirst as jest.Mock).mockResolvedValue(existingAgent);
      let updatedData: any = null;
      (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(async ({ data }: any) => {
        updatedData = data;
        return {
          ...existingAgent,
          ...data,
        };
      });

      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const file = new File([pngBuffer], "new_avatar.png", { type: "image/png" });

      const formData = new FormData();
      formData.append("file", file);

      const result = await updateContactPhoto("agent-detail-123", formData);
      expect(result.success).toBe(true);
      expect(result.photoUrl).toBeDefined();

      expect(updatedData).not.toBeNull();
      expect(updatedData.custom_fields_data).toEqual(
        expect.objectContaining({
          recruiter_name: "Senior Recruiter", // other fields preserved!
          agent_photo: result.photoUrl,
          "Agent Photo": result.photoUrl,
        })
      );
    });

    it("Test 9: Reject invalid file upload (PDF) via updateContactPhoto", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 sample file content", "utf8");
      const file = new File([pdfBuffer], "resume.pdf", { type: "application/pdf" });

      const formData = new FormData();
      formData.append("file", file);

      const result = await updateContactPhoto("agent-detail-123", formData);
      expect(result.error).toBe("Please upload a valid image file.");
      expect(prismadb.crm_Contacts.update).not.toHaveBeenCalled();
    });

    it("Allows removing photo cleanly without removing other custom fields", async () => {
      const existingAgent = {
        id: "agent-detail-123",
        first_name: "Sophia",
        last_name: "Anderson",
        custom_fields_data: {
          recruiter_name: "Senior Recruiter",
          agent_photo: "https://cdn.example.com/old-photo.jpg",
        },
      };

      (prismadb.crm_Contacts.findFirst as jest.Mock).mockResolvedValue(existingAgent);
      let updatedData: any = null;
      (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(async ({ data }: any) => {
        updatedData = data;
        return {
          ...existingAgent,
          ...data,
        };
      });

      const result = await removeContactPhoto("agent-detail-123");
      expect(result.success).toBe(true);
      expect(updatedData.custom_fields_data.agent_photo).toBeUndefined();
      expect(updatedData.custom_fields_data.recruiter_name).toBe("Senior Recruiter");
    });
  });

  describe("5. Agent Detail Page (BasicView Component Structure)", () => {
    it("builds profile header element with ContactPhotoUploader and agent metadata", async () => {
      const agentData = {
        id: "agent-detail-1",
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        city: "New York",
        state: "NY",
        agent_level: "55",
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/sophia-header.jpg",
        },
      };

      const view = await BasicView({ data: agentData });
      expect(view).toBeDefined();

      const renderedStr = JSON.stringify(view);
      expect(renderedStr).toContain("Sophia Anderson");
      expect(renderedStr).toContain("NAA550001");
      expect(renderedStr).toContain("New York, NY");
      expect(renderedStr).toContain("https://cdn.example.com/sophia-header.jpg");
      expect(renderedStr).toContain("SA");
    });
  });
});
