import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { pickSupportedModelFields } from "@/lib/prisma-model-fields";
import { serializeDecimals, serializeDecimalsList } from "@/lib/serialize-decimals";
import { getSalesStageCollections } from "@/lib/crm-sales-stages";

const crmDashboardLeadSelect = {
  id: true,
  createdAt: true,
  firstName: true,
  lastName: true,
  company: true,
  email: true,
  phone: true,
  description: true,
  lead_source_id: true,
  lead_status_id: true,
  lead_type_id: true,
  refered_by: true,
  campaign: true,
  assigned_to: true,
  accountsIDs: true,
} as const;

const crmDashboardContactSelect = pickSupportedModelFields("crm_Contacts", {
  id: true,
  account: true,
  assigned_to: true,
  created_by: true,
  createdBy: true,
  created_on: true,
  cratedAt: true,
  last_activity: true,
  updatedAt: true,
  updatedBy: true,
  last_activity_by: true,
  description: true,
  email: true,
  personal_email: true,
  first_name: true,
  last_name: true,
  office_phone: true,
  mobile_phone: true,
  website: true,
  position: true,
  status: true,
  role: true,
  contact_type_id: true,
  accountsIDs: true,
} as const);

/**
 * Shared CRM metadata fetcher.
 *
 * This is used by multiple CRM routes and server components. Keep the queries
 * serialized and cache the result per request to avoid exhausting the Prisma
 * MariaDB driver pool under concurrent page loads.
 */
export const getAllCrmData = cache(async () => {
  const accounts = await prismadb.crm_Accounts.findMany({
    where: { deletedAt: null },
    include: {
      accountProducts: {
        where: { status: "ACTIVE" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: { deletedAt: null },
  });

  const leads = await prismadb.crm_Leads.findMany({
    where: { deletedAt: null },
    select: crmDashboardLeadSelect,
  });

  const contacts = await prismadb.crm_Contacts.findMany({
    where: { deletedAt: null },
    select: crmDashboardContactSelect,
  });

  const contracts = await prismadb.crm_Contracts.findMany({
    where: { deletedAt: null },
  });

  const saleTypes = await prismadb.crm_Opportunities_Type.findMany({
    orderBy: { name: "asc" },
  });

  const saleStages = await getSalesStageCollections();

  const campaigns = await prismadb.crm_campaigns.findMany({
    where: { deletedAt: null },
  });

  const industries = await prismadb.crm_Industry_Type.findMany({
    orderBy: { name: "asc" },
  });

  const contactTypes = await prismadb.crm_Contact_Types.findMany({
    orderBy: { name: "asc" },
  });

  const leadSources = await prismadb.crm_Lead_Sources.findMany({
    orderBy: { name: "asc" },
  });

  const leadStatuses = await prismadb.crm_Lead_Statuses.findMany({
    orderBy: { name: "asc" },
  });

  const leadTypes = await prismadb.crm_Lead_Types.findMany({
    orderBy: { name: "asc" },
  });

  const currencies = await prismadb.currency.findMany({
    where: { isEnabled: true },
    orderBy: { code: "asc" },
  });

  const exchangeRates = await prismadb.exchangeRate.findMany();

  const productCategories = await prismadb.crm_ProductCategories.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  const products = await prismadb.crm_Products.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: { name: "asc" },
  });

  return serializeDecimals({
    accounts,
    opportunities: serializeDecimalsList(opportunities),
    leads,
    contacts,
    contracts: serializeDecimalsList(contracts),
    saleTypes,
    saleStages: saleStages.regularStages,
    lostStage: saleStages.lostStage,
    campaigns,
    industries,
    contactTypes,
    leadSources,
    leadStatuses,
    leadTypes,
    currencies,
    productCategories,
    products,
    exchangeRates: exchangeRates.map((rate: any) => ({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: Number(rate.rate),
    })),
  });
});
