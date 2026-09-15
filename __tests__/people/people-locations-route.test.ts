jest.mock("@/lib/auth-server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/actions/crm/people/get-people", () => ({
  getPeopleLocations: jest.fn(),
}));

import { GET } from "@/app/api/crm/people/locations/route";
import { getSession } from "@/lib/auth-server";
import { getPeopleLocations } from "@/actions/crm/people/get-people";
import { NextRequest } from "next/server";

describe("GET /api/crm/people/locations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("propagates an unavailable Apollo metadata endpoint instead of returning a successful empty response", async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
    (getPeopleLocations as jest.Mock).mockResolvedValue({
      success: false,
      locations: [],
      countries: [],
      states: [],
      cities: [],
      companies: [],
      error: "Apollo filter options request failed (HTTP 404)",
    });

    const response = await GET(new NextRequest("http://localhost:3000/api/crm/people/locations?country=India&state=Madhya%20Pradesh"));

    expect(response.status).toBe(502);
    expect(getPeopleLocations).toHaveBeenCalledWith({
      country: "India",
      state: "Madhya Pradesh",
      city: undefined,
      companyQuery: undefined,
    });
    expect((await response.json()).success).toBe(false);
  });
});
