jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/actions/crm/people/get-people", () => ({
  getUnifiedPeople: jest.fn(),
}));

import { GET } from "@/app/api/crm/people/route";
import { getSession } from "@/lib/auth-server";
import { getUnifiedPeople } from "@/actions/crm/people/get-people";
import { NextRequest } from "next/server";

describe("GET /api/crm/people", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 Unauthorized when session is missing", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/crm/people");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("proxies Apollo response with real total and source: 'apollo'", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });

    const mockApolloTotal = 15284193;
    (getUnifiedPeople as jest.Mock).mockResolvedValue({
      success: true,
      source: "apollo",
      data: [{ id: "con-1", fullName: "Jane Doe" }],
      total: mockApolloTotal,
      page: 1,
      limit: 50,
      totalPages: Math.ceil(mockApolloTotal / 50),
    });

    const req = new NextRequest("http://localhost:3000/api/crm/people?limit=50&page=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.source).toBe("apollo");
    expect(body.total).toBe(mockApolloTotal);
    expect(body.total).not.toBe(7182);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
  });

  it("forwards the canonical Apollo q search parameter with page-one pagination", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    (getUnifiedPeople as jest.Mock).mockResolvedValue({
      success: true,
      source: "apollo",
      data: [{ id: "con-parekh", fullName: "Parekh Satish" }],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    const req = new NextRequest("http://localhost:3000/api/crm/people?q=parekh%20satish&limit=50&page=1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getUnifiedPeople).toHaveBeenCalledWith(expect.objectContaining({
      query: "parekh satish",
      page: 1,
      limit: 50,
    }));
    expect((await res.json()).data).toEqual([{ id: "con-parekh", fullName: "Parekh Satish" }]);
  });

  it("caps page size at Apollo's 1,000-record maximum without changing the requested page", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });
    (getUnifiedPeople as jest.Mock).mockResolvedValue({
      success: true,
      source: "apollo",
      data: [],
      total: null,
      page: 6,
      limit: 1000,
    });

    const req = new NextRequest("http://localhost:3000/api/crm/people?limit=5000&page=6");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getUnifiedPeople).toHaveBeenCalledWith(expect.objectContaining({
      page: 6,
      limit: 1000,
    }));
  });

  it("preserves a successful full Apollo page when its total is unknown", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });

    const records = Array.from({ length: 50 }, (_, index) => ({
      id: `con-${index + 1}`,
      fullName: `Contact ${index + 1}`,
    }));
    (getUnifiedPeople as jest.Mock).mockResolvedValue({
      success: true,
      source: "apollo",
      data: records,
      total: null,
      page: 1,
      limit: 50,
    });

    const req = new NextRequest("http://localhost:3000/api/crm/people?limit=50&page=1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("apollo");
    expect(body.total).toBeNull();
    expect(body.totalPages).toBeUndefined();
    expect(body.data).toHaveLength(50);
  });

  it("returns 503 with explicit Apollo error and total 0 when Apollo is unavailable", async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: "user-1", role: "admin" },
    });

    (getUnifiedPeople as jest.Mock).mockResolvedValue({
      success: false,
      source: "apollo",
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
      error: "Apollo API service is unavailable",
    });

    const req = new NextRequest("http://localhost:3000/api/crm/people?limit=50&page=1");
    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.source).toBe("apollo");
    expect(body.error).toBe("Apollo API service is unavailable");
    expect(body.total).toBe(0);
    expect(body.total).not.toBe(7182);
    expect(body.data).toEqual([]);
  });
});
