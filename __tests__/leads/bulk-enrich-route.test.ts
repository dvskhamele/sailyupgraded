jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/leads/lead-enrichment-service", () => ({
  bulkEnrichLeads: jest.fn(),
}));

import { POST as postLeadsEnrich } from "@/app/api/leads/enrich/route";
import { POST as postCrmLeadsEnrich } from "@/app/api/crm/leads/enrich/route";
import { getSession } from "@/lib/auth-server";
import { bulkEnrichLeads } from "@/lib/leads/lead-enrichment-service";
import { NextRequest } from "next/server";

describe("POST /api/leads/enrich and /api/crm/leads/enrich", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/leads/enrich", () => {
    it("returns 401 Unauthorized when session is missing", async () => {
      (getSession as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/leads/enrich", {
        method: "POST",
        body: JSON.stringify({ leadIds: ["lead-1"] }),
      });

      const res = await postLeadsEnrich(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 400 when leadIds is missing or empty array", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const req1 = new NextRequest("http://localhost:3000/api/leads/enrich", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res1 = await postLeadsEnrich(req1);
      expect(res1.status).toBe(400);

      const req2 = new NextRequest("http://localhost:3000/api/leads/enrich", {
        method: "POST",
        body: JSON.stringify({ leadIds: [] }),
      });

      const res2 = await postLeadsEnrich(req2);
      expect(res2.status).toBe(400);
    });

    it("calls bulkEnrichLeads with selected leadIds and returns 200", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockResult = {
        success: true,
        total: 2,
        successCount: 2,
        failedCount: 0,
        updatedLeads: [{ id: "l-1" }, { id: "l-2" }],
        failedLeads: [],
      };

      (bulkEnrichLeads as jest.Mock).mockResolvedValue(mockResult);

      const req = new NextRequest("http://localhost:3000/api/leads/enrich", {
        method: "POST",
        body: JSON.stringify({ leadIds: ["l-1", "l-2"] }),
      });

      const res = await postLeadsEnrich(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockResult);
      expect(bulkEnrichLeads).toHaveBeenCalledWith(["l-1", "l-2"], "user-1");
    });

    it("accepts single leadId property and wraps into array", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockResult = {
        success: true,
        total: 1,
        successCount: 1,
        failedCount: 0,
        updatedLeads: [{ id: "l-single" }],
        failedLeads: [],
      };

      (bulkEnrichLeads as jest.Mock).mockResolvedValue(mockResult);

      const req = new NextRequest("http://localhost:3000/api/leads/enrich", {
        method: "POST",
        body: JSON.stringify({ leadId: "l-single" }),
      });

      const res = await postLeadsEnrich(req);
      expect(res.status).toBe(200);
      expect(bulkEnrichLeads).toHaveBeenCalledWith(["l-single"], "user-1");
    });
  });

  describe("POST /api/crm/leads/enrich", () => {
    it("returns 200 and calls bulkEnrichLeads for CRM endpoint", async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: "user-2", email: "user2@test.com" },
      });

      const mockResult = {
        success: true,
        total: 1,
        successCount: 1,
        failedCount: 0,
        updatedLeads: [{ id: "l-crm" }],
        failedLeads: [],
      };

      (bulkEnrichLeads as jest.Mock).mockResolvedValue(mockResult);

      const req = new NextRequest("http://localhost:3000/api/crm/leads/enrich", {
        method: "POST",
        body: JSON.stringify({ ids: ["l-crm"] }),
      });

      const res = await postCrmLeadsEnrich(req);
      expect(res.status).toBe(200);
      expect(bulkEnrichLeads).toHaveBeenCalledWith(["l-crm"], "user-2");
    });
  });
});
