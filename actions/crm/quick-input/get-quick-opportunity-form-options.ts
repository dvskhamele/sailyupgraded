"use server";

import { prismadb } from "@/lib/prisma";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { getSalesStageCollections } from "@/lib/crm-sales-stages";

export async function getQuickOpportunityFormOptions() {
  const [accounts, contacts, salesType, stageCollections, campaigns, currencies, products] = await Promise.all([
    prismadb.crm_Accounts.findMany({
      where: { deletedAt: null },
      include: {
        accountProducts: {
          where: { status: "ACTIVE" },
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prismadb.crm_Contacts.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        serial: true,
        first_name: true,
        last_name: true,
        accountsIDs: true,
      },
      orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
    }),
    prismadb.crm_Opportunities_Type.findMany({
      orderBy: { name: "asc" },
    }),
    getSalesStageCollections(),
    prismadb.crm_campaigns.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prismadb.currency.findMany({
      where: { isEnabled: true },
      orderBy: { code: "asc" },
    }),
    prismadb.crm_Products.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: {
        name: true,
        unit_price: true,
        currency: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const categoryOptions = Array.from(
    new Map(
      products
        .map((product) => {
          const value = product.name.trim();
          if (!value) return null;

          const amount = Number(product.unit_price);
          const label = Number.isFinite(amount) && product.currency
            ? `${value} - ${amount.toFixed(2)} ${product.currency}`
            : value;

          return [value, { value, label }] as const;
        })
        .filter((item): item is readonly [string, { value: string; label: string }] => Boolean(item)),
    ).values(),
  );

  return serializeDecimals({
    accounts,
    contacts,
    salesType,
    saleStages: stageCollections.regularStages,
    campaigns,
    currencies,
    categoryOptions,
  });
}
