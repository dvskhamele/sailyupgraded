jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Contact_Types: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
  withPrismaRetry: (fn: () => unknown) => fn(),
}));

import { prismadb } from "@/lib/prisma";
import { ensureDefaultContactTypes } from "@/lib/crm/contact-form-options";

const mockPrisma = prismadb as jest.Mocked<typeof prismadb>;

describe("ensureDefaultContactTypes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hides legacy contact types and returns the configured POC/department options in order", async () => {
    const rolePlaceholder = `${String.fromCharCode(60)}ROLE${String.fromCharCode(62)}`;
    const hiddenTypes = [
      { id: "agent", name: "Agent" },
      { id: "customer", name: "Customer" },
      { id: "partner", name: "Partner" },
      { id: "vendor", name: "Vendor" },
      { id: "role-placeholder-known", name: `${rolePlaceholder} KNOWN FOR YEARS` },
      { id: "role-placeholder-risk", name: `HIGH_RISK ${rolePlaceholder}` },
      { id: "role-placeholder-unknown", name: `UNKNOWN ${rolePlaceholder}` },
      { id: "marketing-combined", name: "MARKETING DEPARTMENT KNOWN KNOWN FOR YEARS" },
    ];
    const configuredTypes = [
      { id: "poc-1", name: "POC 1 TO 5YRS" },
      { id: "poc-ref", name: "POC BUSINESS REFERRAL" },
      { id: "poc-new", name: "POC NEW UNDER 1YR" },
      { id: "finance-known", name: "FINANCE DEPARTMENT KNOWN" },
      { id: "finance-new", name: "FINANCE DEPARTMENT NEW" },
      { id: "technical-known", name: "TECHNICAL DEPARTMENT KNOWN" },
      { id: "technical-new", name: "TECHNICAL DEPARTMENT NEW" },
      { id: "legal-known", name: "LEGAL DEPARTMENT KNOWN" },
      { id: "legal-unknown", name: "LEGAL DEPARTMENT UNKNOWN" },
      { id: "supporter-champion", name: "SUPPORTER CHAMPION ALLY" },
      { id: "supporter-neutral", name: "SUPPORTER NEUTRAL" },
      { id: "untrusted", name: "UNTRUSTED HIGH RISK" },
      { id: "principal-main", name: "PRINCIPAL MAIN OWNER 5YRS PLUS" },
      { id: "principal-established", name: "PRINCIPAL ESTABLISHED 1 TO 5YRS" },
      { id: "principal-new", name: "PRINCIPAL NEW UNDER 1YR" },
      { id: "decision-maker", name: "DECISION MAKER FROM TEAM" },
      { id: "marketing-new", name: "MARKETING DEPARTMENT NEW" },
      { id: "marketing-known", name: "MARKETING DEPARTMENT KNOWN" },
      { id: "known-for-years", name: "KNOWN FOR YEARS" },
      { id: "high-risk-role", name: "HIGH_RISK" },
      { id: "unknown-role", name: "UNKNOWN" },
    ];

    (mockPrisma.crm_Contact_Types.findMany as jest.Mock).mockResolvedValue([
      ...hiddenTypes,
      ...configuredTypes,
    ]);

    await expect(ensureDefaultContactTypes()).resolves.toEqual(configuredTypes);
  });
});
