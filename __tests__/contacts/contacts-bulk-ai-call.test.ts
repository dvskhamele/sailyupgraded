import { bulkAICallContacts } from "@/actions/crm/calls/bulk-ai-call";
import { normalizeE164PhoneNumber, isE164PhoneNumber } from "@/lib/retell-client";
import {
  getContactDisplayName,
  getContactRawPhone,
  cleanWhatsAppPhoneNumber,
  type ContactPhoneSource,
} from "@/lib/whatsapp-extension";
import { prismadb } from "@/lib/prisma";
import * as authServer from "@/lib/auth-server";
import * as retellServer from "@/lib/retell-server";

// Mock dependencies
jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/retell-server", () => ({
  getRetellApiKey: jest.fn(),
  getConfiguredRetellPhoneNumber: jest.fn(),
  ensureRetellAgentWebhookUrl: jest.fn(),
  getFirstRetellVoiceAgent: jest.fn(),
  RETELL_API_BASE_URL: "https://api.retellai.com",
}));

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_LeadCallTracking: {
      upsert: jest.fn(),
    },
  },
}));

describe("Contacts — Bulk AI Call System", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (authServer.getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-123", email: "agent@example.com" },
    });
    (retellServer.getRetellApiKey as jest.Mock).mockResolvedValue("mock-retell-key-12345");
    (retellServer.getConfiguredRetellPhoneNumber as jest.Mock).mockResolvedValue("+14155552671");
    (retellServer.ensureRetellAgentWebhookUrl as jest.Mock).mockResolvedValue(undefined);
    (prismadb.crm_LeadCallTracking.upsert as jest.Mock).mockResolvedValue({});
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("1. Phone Number Validation & E.164 Normalization", () => {
    it("validates and normalizes valid phone numbers to E.164 format", () => {
      expect(normalizeE164PhoneNumber("+91 97527 88803")).toBe("+919752788803");
      expect(isE164PhoneNumber(normalizeE164PhoneNumber("+91 97527 88803"))).toBe(true);

      expect(normalizeE164PhoneNumber("+1 (555) 010-1234")).toBe("+15550101234");
      expect(isE164PhoneNumber(normalizeE164PhoneNumber("+1 (555) 010-1234"))).toBe(true);
    });

    it("rejects missing, empty, or placeholder numbers", () => {
      expect(cleanWhatsAppPhoneNumber("")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("unavailable")).toBeNull();
      expect(cleanWhatsAppPhoneNumber("n/a")).toBeNull();
      expect(isE164PhoneNumber(normalizeE164PhoneNumber(""))).toBe(false);
    });

    it("correctly partitions selected contacts into ready and skipped lists", () => {
      const contacts: ContactPhoneSource[] = [
        { id: "c1", first_name: "Rahul", last_name: "Sharma", mobile_phone: "+91 97527 88803" },
        { id: "c2", first_name: "Amit", last_name: "Sharma", phone: "+91 9876543210" },
        { id: "c3", first_name: "NoPhone", last_name: "Contact", mobile_phone: "" },
      ];

      const ready = contacts.filter((c) => {
        const raw = getContactRawPhone(c);
        const clean = cleanWhatsAppPhoneNumber(raw);
        const norm = normalizeE164PhoneNumber(raw || "");
        return Boolean(raw && clean && isE164PhoneNumber(norm));
      });

      const skipped = contacts.filter((c) => !ready.includes(c));

      expect(ready).toHaveLength(2);
      expect(skipped).toHaveLength(1);
      expect(ready[0].first_name).toBe("Rahul");
      expect(ready[1].first_name).toBe("Amit");
      expect(skipped[0].first_name).toBe("NoPhone");
    });
  });

  describe("2. Single and Bulk AI Call Execution via Retell Provider", () => {
    it("initiates an AI call for a single contact with metadata and creates CRM tracking", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          call_id: "call_abc123",
          agent_id: "agent_retell_1",
          call_status: "registered",
        }),
      });

      const result = await bulkAICallContacts({
        agentId: "agent_retell_1",
        callPurpose: "Lead Qualification",
        contacts: [
          {
            id: "c1",
            name: "Rahul Sharma",
            phone: "+919752788803",
            email: "rahul@example.com",
            company: "Acme Corp",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.queued).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results[0].callId).toBe("call_abc123");

      // Verify Retell API request payload
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.retellai.com/v2/create-phone-call",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-retell-key-12345",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            from_number: "+14155552671",
            to_number: "+919752788803",
            override_agent_id: "agent_retell_1",
            metadata: {
              source: "crm-bulk-ai-call",
              contact_id: "c1",
              contact_name: "Rahul Sharma",
              contact_email: "rahul@example.com",
              contact_company: "Acme Corp",
              call_purpose: "Lead Qualification",
              crm_user_id: "user-123",
            },
            retell_llm_dynamic_variables: {
              customer_name: "Rahul Sharma",
              customer_email: "rahul@example.com",
              customer_state: "",
              customer_company: "Acme Corp",
              call_purpose: "Lead Qualification",
            },
          }),
        })
      );

      // Verify CRM call tracking upsert
      expect(prismadb.crm_LeadCallTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callId: "call_abc123" },
          create: expect.objectContaining({
            callId: "call_abc123",
            memberId: "c1",
            phone: "+919752788803",
            agentId: "agent_retell_1",
            callStatus: "registered",
          }),
        })
      );
    });

    it("requires an explicit AI agent to be selected and fails if agentId is missing", async () => {
      const result = await bulkAICallContacts({
        agentId: "",
        contacts: [{ id: "c1", name: "Rahul Sharma", phone: "+919752788803" }],
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(0);
      expect(result.error).toBe("No AI calling agent selected. Please select an AI agent.");
    });

    it("processes multiple contacts and handles partial failures accurately", async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First contact succeeds
          return Promise.resolve({
            ok: true,
            json: async () => ({
              call_id: "call_111",
              agent_id: "agent_retell_1",
              call_status: "registered",
            }),
          });
        } else {
          // Second contact fails with provider error
          return Promise.resolve({
            ok: false,
            json: async () => ({
              error: "Carrier blocked destination number",
            }),
          });
        }
      });

      const result = await bulkAICallContacts({
        agentId: "agent_retell_1",
        contacts: [
          { id: "c1", name: "Rahul Sharma", phone: "+919752788803" },
          { id: "c2", name: "Amit Sharma", phone: "+919876543210" },
        ],
      });

      expect(result.total).toBe(2);
      expect(result.queued).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].callId).toBe("call_111");
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe("Carrier blocked destination number");
    });

    it("fails early if AI calling integration credentials are not configured", async () => {
      (retellServer.getRetellApiKey as jest.Mock).mockResolvedValue(null);

      const result = await bulkAICallContacts({
        agentId: "agent_retell_1",
        contacts: [{ id: "c1", name: "Rahul Sharma", phone: "+919752788803" }],
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(0);
      expect(result.error).toContain("AI calling is not configured");
    });
  });
});
