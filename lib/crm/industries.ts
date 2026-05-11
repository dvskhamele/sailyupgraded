import { prismadb } from "@/lib/prisma";

export const DEFAULT_ACCOUNT_INDUSTRIES = [
  "INFORMATION_TECHNOLOGY",
  "SOFTWARE",
  "SAAS",
  "ARTIFICIAL_INTELLIGENCE",
  "MARKETING_ADVERTISING",
  "MEDIA_ENTERTAINMENT",
  "FINANCE",
  "BANKING",
  "INSURANCE",
  "FINTECH",
  "REAL_ESTATE",
  "CONSTRUCTION",
  "HEALTHCARE",
  "PHARMACEUTICALS",
  "EDUCATION",
  "E_LEARNING",
  "RETAIL",
  "ECOMMERCE",
  "WHOLESALE",
  "MANUFACTURING",
  "AUTOMOTIVE",
  "LOGISTICS_TRANSPORTATION",
  "TELECOMMUNICATIONS",
  "LEGAL_SERVICES",
  "CONSULTING",
  "HUMAN_RESOURCES",
  "HOSPITALITY_TRAVEL",
  "FOOD_BEVERAGE",
  "AGRICULTURE",
  "GOVERNMENT",
  "NON_PROFIT",
  "EVENT_MANAGEMENT",
  "FASHION_BEAUTY",
  "CYBERSECURITY",
  "BLOCKCHAIN_WEB3",
  "OTHER",
] as const;

export async function getAccountIndustries() {
  const existingIndustries = await prismadb.crm_Industry_Type.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const existingNames = new Set(existingIndustries.map((industry) => industry.name));
  const missingIndustries = DEFAULT_ACCOUNT_INDUSTRIES.filter(
    (name) => !existingNames.has(name)
  );

  if (missingIndustries.length > 0) {
    await prismadb.crm_Industry_Type.createMany({
      data: missingIndustries.map((name, index) => ({
        name,
        v: 0,
        order: existingIndustries.length + index + 1,
      })),
    });

    return prismadb.crm_Industry_Type.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  return existingIndustries;
}
