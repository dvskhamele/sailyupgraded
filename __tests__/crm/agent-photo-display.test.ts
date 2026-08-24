import {
  extractAgentPhotoUrl,
  getAgentInitials,
} from "@/lib/crm/agent-photo";
import { BasicView } from "@/app/[locale]/(routes)/crm/contacts/[contactId]/components/BasicView";
import { createContact } from "@/actions/crm/contacts/create-contact";
import { updateContact } from "@/actions/crm/contacts/update-contact";
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

describe("Agent Photo Display & Helper Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. extractAgentPhotoUrl helper", () => {
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

    it("extracts photo from direct agent_photo or photo field", () => {
      const data1 = { agent_photo: "https://cdn.example.com/direct-agent.png" };
      expect(extractAgentPhotoUrl(data1)).toBe("https://cdn.example.com/direct-agent.png");

      const data2 = { photo: "https://cdn.example.com/photo.png" };
      expect(extractAgentPhotoUrl(data2)).toBe("https://cdn.example.com/photo.png");

      const data3 = { avatar: "https://cdn.example.com/avatar.png" };
      expect(extractAgentPhotoUrl(data3)).toBe("https://cdn.example.com/avatar.png");
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

    it("extracts photo from imported_columns_data", () => {
      const data = {
        imported_columns_data: [
          {
            column: "agent_photo",
            label: "Agent Photo",
            value: "https://cdn.example.com/imported-agent.png",
          },
        ],
      };
      expect(extractAgentPhotoUrl(data)).toBe(
        "https://cdn.example.com/imported-agent.png",
      );
    });

    it("filters out placeholder instruction text (e.g. 'Add agent photo here', 'n/a')", () => {
      const data1 = {
        custom_fields_data: { agent_photo: "Add agent photo here" },
      };
      expect(extractAgentPhotoUrl(data1)).toBeNull();

      const data2 = { custom_fields_data: { agent_photo: "none" } };
      expect(extractAgentPhotoUrl(data2)).toBeNull();

      const data3 = { custom_fields_data: { agent_photo: "" } };
      expect(extractAgentPhotoUrl(data3)).toBeNull();

      const data4 = { custom_fields_data: null };
      expect(extractAgentPhotoUrl(data4)).toBeNull();
    });
  });

  describe("2. getAgentInitials helper", () => {
    it("returns two-letter uppercase initials for full name", () => {
      expect(
        getAgentInitials({ first_name: "Sophia", last_name: "Anderson" }),
      ).toBe("SA");
      expect(getAgentInitials({ first_name: "john", last_name: "doe" })).toBe(
        "JD",
      );
    });

    it("returns single-letter initial when only first or last name is present", () => {
      expect(getAgentInitials({ first_name: "Sophia", last_name: "" })).toBe(
        "S",
      );
      expect(getAgentInitials({ first_name: "", last_name: "Anderson" })).toBe(
        "A",
      );
    });

    it("falls back to name field or email if first/last names are missing", () => {
      expect(getAgentInitials({ name: "Sophia Anderson" })).toBe("SA");
      expect(getAgentInitials({ email: "sophia@example.com" })).toBe("S");
      expect(getAgentInitials({})).toBe("?");
      expect(getAgentInitials(null)).toBe("?");
    });
  });

  describe("3. Create Agent with photo & verify persistence", () => {
    it("persists agent_photo in custom_fields_data on creation", async () => {
      let createdData: any = null;
      (prismadb.crm_Contacts.create as jest.Mock).mockImplementation(
        async ({ data }: any) => {
          createdData = data;
          return {
            id: "agent-new-1",
            first_name: data.first_name,
            last_name: data.last_name,
            serial: data.serial,
            role: data.role,
            status: data.status,
            custom_fields_data: data.custom_fields_data,
          };
        },
      );

      const payload = {
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/sophia-profile.jpg",
          "Agent Photo": "https://cdn.example.com/sophia-profile.jpg",
        },
      };

      const result = await createContact(payload as any);
      expect(result.data).toBeDefined();
      expect(createdData).not.toBeNull();
      expect(createdData.custom_fields_data).toEqual(
        expect.objectContaining({
          agent_photo: "https://cdn.example.com/sophia-profile.jpg",
        }),
      );
      expect(extractAgentPhotoUrl(result.data)).toBe(
        "https://cdn.example.com/sophia-profile.jpg",
      );
    });
  });

  describe("4. Update Agent with new photo & verify persistence", () => {
    it("updates agent_photo in custom_fields_data on update", async () => {
      const existingAgent = {
        id: "agent-1",
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/old-sophia.jpg",
        },
      };

      (prismadb.crm_Contacts.findFirst as jest.Mock).mockResolvedValue(
        existingAgent,
      );
      let updatedData: any = null;
      (prismadb.crm_Contacts.update as jest.Mock).mockImplementation(
        async ({ data }: any) => {
          updatedData = data;
          return {
            ...existingAgent,
            ...data,
          };
        },
      );

      const updatePayload = {
        id: "agent-1",
        first_name: "Sophia",
        last_name: "Anderson",
        custom_fields_data: {
          agent_photo: "https://cdn.example.com/new-sophia-2026.jpg",
        },
      };

      const result = await updateContact(updatePayload as any);
      expect(result.data).toBeDefined();
      expect(updatedData).not.toBeNull();
      expect(updatedData.custom_fields_data.agent_photo).toBe(
        "https://cdn.example.com/new-sophia-2026.jpg",
      );
      expect(extractAgentPhotoUrl(result.data)).toBe(
        "https://cdn.example.com/new-sophia-2026.jpg",
      );
    });
  });

  describe("5. Agent Detail Page (BasicView Component Structure)", () => {
    it("builds profile header element with Agent Photo URL, initials fallback, and agent metadata", async () => {
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

      // Verify photo extraction on the data
      const photoUrl = extractAgentPhotoUrl(agentData);
      expect(photoUrl).toBe("https://cdn.example.com/sophia-header.jpg");

      // Verify initials
      const initials = getAgentInitials(agentData);
      expect(initials).toBe("SA");

      // Stringify the rendered JSX structure to inspect props and children
      const renderedStr = JSON.stringify(view);
      expect(renderedStr).toContain("Sophia Anderson");
      expect(renderedStr).toContain("NAA550001");
      expect(renderedStr).toContain("New York, NY");
      expect(renderedStr).toContain("https://cdn.example.com/sophia-header.jpg");
      expect(renderedStr).toContain("SA");
    });

    it("builds fallback avatar with initials when no photo exists", async () => {
      const agentWithoutPhoto = {
        id: "agent-detail-2",
        first_name: "Sophia",
        last_name: "Anderson",
        serial: "NAA550001",
        role: "Agent",
        status: true,
        city: "New York",
        state: "NY",
        custom_fields_data: null,
      };

      const view = await BasicView({ data: agentWithoutPhoto });
      expect(view).toBeDefined();

      const photoUrl = extractAgentPhotoUrl(agentWithoutPhoto);
      expect(photoUrl).toBeNull();

      const initials = getAgentInitials(agentWithoutPhoto);
      expect(initials).toBe("SA");

      const renderedStr = JSON.stringify(view);
      expect(renderedStr).toContain("Sophia Anderson");
      expect(renderedStr).toContain("SA");
    });
  });
});
