jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/contacts/bulk-enrichment-service", () => ({
  bulkEnrichContacts: jest.fn(),
}));

import { POST } from "@/app/api/contacts/enrich/route";
import { getSession } from "@/lib/auth-server";
import { bulkEnrichContacts } from "@/lib/contacts/bulk-enrichment-service";
import { NextRequest } from "next/server";

describe("POST /api/contacts/enrich", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 Unauthorized when session is missing", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/contacts/enrich", {
      method: "POST",
      body: JSON.stringify({ contactIds: ["id-1"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when contactIds is missing or empty array", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", email: "user@test.com" },
    });

    const req1 = new NextRequest("http://localhost:3000/api/contacts/enrich", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(400);

    const req2 = new NextRequest("http://localhost:3000/api/contacts/enrich", {
      method: "POST",
      body: JSON.stringify({ contactIds: [] }),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it("calls bulkEnrichContacts with selected contactIds and returns 200", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", email: "user@test.com" },
    });

    const mockResult = {
      success: true,
      total: 2,
      successCount: 2,
      failedCount: 0,
      updatedContacts: [{ id: "c-1" }, { id: "c-2" }],
      failedContacts: [],
    };

    (bulkEnrichContacts as jest.Mock).mockResolvedValue(mockResult);

    const req = new NextRequest("http://localhost:3000/api/contacts/enrich", {
      method: "POST",
      body: JSON.stringify({ contactIds: ["c-1", "c-2"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResult);
    expect(bulkEnrichContacts).toHaveBeenCalledWith(["c-1", "c-2"], "user-1");
  });
});
