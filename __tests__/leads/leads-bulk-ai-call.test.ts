import { bulkAICallContacts } from "@/actions/crm/calls/bulk-ai-call";
import { prismadb } from "@/lib/prisma";
import * as retellServer from "@/lib/retell-server";
import { getContactDisplayName, getContactRawPhone } from "@/lib/whatsapp-extension";
import { normalizeE164PhoneNumber, isE164PhoneNumber } from "@/lib/retell-client";

// Mock dependencies
jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "user-123", email: "sales@example.com", role: "admin" },
  }),
}));

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_LeadCallTracking: {
      upsert: jest.fn().mockResolvedValue({ id: "track_1" }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock("@/lib/retell-server", () => ({
  getRetellApiKey: jest.fn().mockResolvedValue("mock-retell-key-leads-12345"),
  getConfiguredRetellPhoneNumber: jest.fn().mockResolvedValue("+14155552671"),
  ensureRetellAgentWebhookUrl: jest.fn().mockResolvedValue(true),
  getFirstRetellVoiceAgent: jest.fn().mockResolvedValue(null),
  listRetellAgents: jest.fn().mockResolvedValue([
    { id: "agent_lead_qualification", name: "Lead Qualification Agent", isPublished: true },
    { id: "agent_demo_booking", name: "Demo Booking Agent", isPublished: true },
    { id: "agent_follow_up", name: "Follow-up Agent", isPublished: true },
  ]),
}));

describe("Leads Bulk AI Calling Architecture & Workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        call_id: "call_lead_abc123",
        agent_id: "agent_lead_qualification",
        agent_version: 1,
        call_status: "registered",
      }),
    });
  });

  describe("Lead Phone Extraction & E.164 Resolution", () => {
    it("resolves raw phone numbers from various Lead schema fields", () => {
      const lead1 = { id: "l1", firstName: "Rahul", lastName: "Sharma", phone: "+919752788803" };
      const lead2 = { id: "l2", firstName: "Amit", mobile_phone: "9876543210" };
      const lead3 = { id: "l3", firstName: "Raj", office_phone: "+1 415 555 2671" };

      expect(getContactRawPhone(lead1)).toBe("+919752788803");
      expect(getContactRawPhone(lead2)).toBe("9876543210");
      expect(getContactRawPhone(lead3)).toBe("+1 415 555 2671");
    });

    it("normalizes and validates international E.164 format for leads", () => {
      expect(normalizeE164PhoneNumber("+919752788803")).toBe("+919752788803");
      expect(isE164PhoneNumber("+919752788803")).toBe(true);

      // Number without plus
      expect(normalizeE164PhoneNumber("919752788803")).toBe("+919752788803");
      expect(isE164PhoneNumber("+919752788803")).toBe(true);

      // Invalid short phone number
      expect(normalizeE164PhoneNumber("123")).toBe("123");
      expect(isE164PhoneNumber("123")).toBe(false);
    });

    it("extracts display name accurately for leads", () => {
      expect(getContactDisplayName({ id: "l1", firstName: "Rahul", lastName: "Sharma" })).toBe("Rahul Sharma");
      expect(getContactDisplayName({ id: "l2", firstName: "Amit" })).toBe("Amit");
      expect(getContactDisplayName({ id: "l3", name: "Raj Sharma" })).toBe("Raj Sharma");
      expect(getContactDisplayName({ id: "l4" })).toBe("Contact");
    });
  });

  describe("Bulk AI Call Server Action Execution for Leads", () => {
    it("queues a single lead with valid phone number and passes internal agentId", async () => {
      const result = await bulkAICallContacts({
        agentId: "agent_lead_qualification",
        agentVersion: 1,
        callPurpose: "Initial Qualification",
        contacts: [
          {
            id: "lead_101",
            name: "Rahul Sharma",
            phone: "+919752788803",
            email: "rahul@example.com",
            company: "Tech Corp",
            state: "California",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.queued).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results[0].callId).toBe("call_lead_abc123");

      // Verify Retell API payload includes dynamic LLM variables and metadata
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.retellai.com/v2/create-phone-call",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-retell-key-leads-12345",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            from_number: "+14155552671",
            to_number: "+919752788803",
            override_agent_id: "agent_lead_qualification",
            metadata: {
              source: "crm-bulk-ai-call",
              contact_id: "lead_101",
              lead_id: "lead_101",
              entity_id: "lead_101",
              contact_name: "Rahul Sharma",
              contact_email: "rahul@example.com",
              contact_company: "Tech Corp",
              call_purpose: "Initial Qualification",
              crm_user_id: "user-123",
            },
            retell_llm_dynamic_variables: {
              customer_name: "Rahul Sharma",
              customer_email: "rahul@example.com",
              customer_state: "California",
              customer_company: "Tech Corp",
              call_purpose: "Initial Qualification",
            },
            override_agent_version: 1,
          }),
        })
      );

      // Verify Lead Call Tracking in CRM database
      expect(prismadb.crm_LeadCallTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callId: "call_lead_abc123" },
          create: expect.objectContaining({
            callId: "call_lead_abc123",
            opportunityId: "lead_101",
            memberId: "lead_101",
            phone: "+919752788803",
            agentId: "agent_lead_qualification",
            callStatus: "registered",
          }),
        })
      );
    });

    it("requires explicit agent selection and rejects if agentId is missing", async () => {
      const result = await bulkAICallContacts({
        agentId: "",
        contacts: [{ id: "l1", name: "Rahul", phone: "+919752788803" }],
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(0);
      expect(result.error).toBe("No AI calling agent selected. Please select an AI agent.");
    });

    it("processes multiple leads and partitions successes and invalid numbers accurately", async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            call_id: `call_lead_${callCount}`,
            agent_id: "agent_demo_booking",
            call_status: "registered",
          }),
        });
      });

      const result = await bulkAICallContacts({
        agentId: "agent_demo_booking",
        contacts: [
          { id: "l1", name: "Rahul Sharma", phone: "+919752788803" },
          { id: "l2", name: "Amit Sharma", phone: "invalid-phone" },
          { id: "l3", name: "Raj Sharma", phone: "+919876543210" },
        ],
      });

      expect(result.total).toBe(3);
      expect(result.queued).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].callId).toBe("call_lead_1");
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain("Invalid phone number");
      expect(result.results[2].success).toBe(true);
      expect(result.results[2].callId).toBe("call_lead_2");
    });

    it("fails early if voice calling integration credentials are not configured", async () => {
      (retellServer.getRetellApiKey as jest.Mock).mockResolvedValueOnce(null);

      const result = await bulkAICallContacts({
        agentId: "agent_lead_qualification",
        contacts: [{ id: "l1", name: "Rahul Sharma", phone: "+919752788803" }],
      });

      expect(result.success).toBe(false);
      expect(result.queued).toBe(0);
      expect(result.error).toContain("AI calling is not configured");
    });

    it("does NOT hard-code Retail AI or auto-pick any vendor", async () => {
      const result = await bulkAICallContacts({
        agentId: "agent_custom_configured",
        contacts: [{ id: "l1", name: "Custom Agent Lead", phone: "+919752788803" }],
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.retellai.com/v2/create-phone-call",
        expect.objectContaining({
          body: expect.stringContaining('"override_agent_id":"agent_custom_configured"'),
        })
      );
    });
  });
});
