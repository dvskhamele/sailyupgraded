import { buildContactRoleFilter, matchesContactRoleFilter } from "@/lib/contact-options";

describe("buildContactRoleFilter", () => {
  it("maps customer-like filters to customer and client roles", () => {
    expect(buildContactRoleFilter("customer")).toEqual({
      role: {
        in: ["Customer", "Client"],
      },
    });
  });

  it("maps agent filters to the agent role", () => {
    expect(buildContactRoleFilter("agents")).toEqual({
      role: "Agent",
    });
  });

  it("treats others as any non-customer and non-agent role", () => {
    expect(buildContactRoleFilter("others")).toEqual({
      role: {
        notIn: ["Customer", "Client", "Agent"],
      },
    });
  });

  it("matches partner and vendor roles under others", () => {
    expect(matchesContactRoleFilter("others", "Partner")).toBe(true);
    expect(matchesContactRoleFilter("others", "Vendor")).toBe(true);
    expect(matchesContactRoleFilter("others", "Customer")).toBe(false);
    expect(matchesContactRoleFilter("others", "Agent")).toBe(false);
  });
});
