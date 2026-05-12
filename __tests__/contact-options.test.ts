import { buildContactRoleFilter, getReferenceId, matchesContactRoleFilter } from "@/lib/contact-options";

describe("buildContactRoleFilter", () => {
  it("maps customer-like filters to customer and client roles", () => {
    expect(buildContactRoleFilter("customer")).toEqual({
      role: {
        in: ["Customer", "customer", "Customers", "customers", "Client", "client", "Clients", "clients"],
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

describe("getReferenceId", () => {
  it("uses agent-specific identifiers before the stored fallback", () => {
    expect(getReferenceId({ role: "Agent", agentNumber: "A-100", serial: "S-1" })).toBe("A-100");
    expect(getReferenceId({ role: "Agent", agentId: "AG-42" })).toBe("AG-42");
  });

  it("uses customer and client-specific identifiers independently", () => {
    expect(getReferenceId({ role: "Customer", customerNumber: "C-100" })).toBe("C-100");
    expect(getReferenceId({ role: "Client", clientId: "CL-42", customerId: "C-42" })).toBe("CL-42");
  });

  it("uses other identifiers for non-agent/customer/client roles and falls back to dash", () => {
    expect(getReferenceId({ role: "Vendor", otherId: "V-1", serial: "S-1" })).toBe("V-1");
    expect(getReferenceId({ role: "Customer" })).toBe("-");
  });
});
