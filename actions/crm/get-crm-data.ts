import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { getSalesStageCollections } from "@/lib/crm-sales-stages";

const crmDashboardLeadSelect = Prisma.validator<Prisma.crm_LeadsSelect>()({
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
});

const crmDashboardContactSelect = Prisma.validator<Prisma.crm_ContactsSelect>()({
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
  contact_type_id: true,
  accountsIDs: true,
});

/**
 * CRM Data Fetcher - Task Group 2.3
 *
 * Fetches all necessary data for CRM module views.
 * Implements query batching to avoid database connection pool timeouts.
 *
 * References:
 * - DriverAdapterError pool timeout: happens when firing too many parallel queries
 * - Default pool limit: 10 connections
 */
export const getAllCrmData = (async () => {
  // Batch 1: Primary CRM Entities (5 queries)
  const [
    accounts,
    opportunities,
    leads,
    contacts,
    contracts,
  ] = await Promise.all([
    prismadb.crm_Accounts.findMany({ where: { deletedAt: null } }),

    prismadb.crm_Opportunities.findMany({ where: { deletedAt: null } }),

    // ❌ crm_Leads me order field nahi hai → remove it
    prismadb.crm_Leads.findMany({
      where: { deletedAt: null },
      select: crmDashboardLeadSelect,
    }),

    prismadb.crm_Contacts.findMany({
      where: { deletedAt: null },
      select: crmDashboardContactSelect,
    }),

    prismadb.crm_Contracts.findMany({ where: { deletedAt: null } }),
  ]);

  // Batch 2: Configuration & Metadata (5 queries)
  const [
    saleTypes,
    saleStages,
    campaigns,
    industries,
    contactTypes,
  ] = await Promise.all([
    // ❌ no order field → use name
    prismadb.crm_Opportunities_Type.findMany({
      orderBy: { name: "asc" },
    }),

    getSalesStageCollections(), // ✅ yahi se stages ka order control hoga

    prismadb.crm_campaigns.findMany({ where: { deletedAt: null } }),

    // ❌ no order field
    prismadb.crm_Industry_Type.findMany({
      orderBy: { name: "asc" },
    }),

    // ❌ no order field
    prismadb.crm_Contact_Types.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  // Batch 3: Remaining metadata and regional settings (6 queries)
  const [
    leadSources,
    leadStatuses,
    leadTypes,
    currencies,
    exchangeRates,
    productCategories,
  ] = await Promise.all([
    // ❌ no order field
    prismadb.crm_Lead_Sources.findMany({
      orderBy: { name: "asc" },
    }),

    // ✅ ONLY THIS SHOULD USE order
    prismadb.crm_Lead_Statuses.findMany({
      orderBy: { name: "asc" },
    }),

    // ❌ no order field
    prismadb.crm_Lead_Types.findMany({
      orderBy: { name: "asc" },
    }),

    prismadb.currency.findMany({
      where: { isEnabled: true },
      orderBy: { code: "asc" },
    }),

    prismadb.exchangeRate.findMany(),

    // ✅ already correct (has order field)
    prismadb.crm_ProductCategories.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const data = {
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
    exchangeRates: exchangeRates.map((r: any) => ({
      fromCurrency: r.fromCurrency,
      toCurrency: r.toCurrency,
      rate: Number(r.rate),
    })),
  };

  return data;
});
