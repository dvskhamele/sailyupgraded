import type { Prisma } from "@prisma/client";

import { getSession } from "@/lib/auth-server";
import { buildContactRoleFilter } from "@/lib/contact-options";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import {
  isTransientPrismaConnectionError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";

export type CrmSidebarCounts = {
  dashboard: number;
  opportunities: number;
  company: number;
  products: number;
  contacts: number;
  leads: number;
  customers: number;
  agents: number;
  others: number;
  activities: number;
  aiActivities: number;
  templates: number;
};

const emptyCounts: CrmSidebarCounts = {
  dashboard: 0,
  opportunities: 0,
  company: 0,
  products: 0,
  contacts: 0,
  leads: 0,
  customers: 0,
  agents: 0,
  others: 0,
  activities: 0,
  aiActivities: 0,
  templates: 0,
};

const contactCountWhere = (
  visibilityFilter: Prisma.crm_ContactsWhereInput,
  role?: string,
): Prisma.crm_ContactsWhereInput => ({
  deletedAt: null,
  ...visibilityFilter,
  ...buildContactRoleFilter(role),
});

export async function getCrmSidebarCounts(): Promise<CrmSidebarCounts> {
  const session = await getSession();

  if (!session) {
    return emptyCounts;
  }

  // For guest session, return sample counts or empty? Let's return empty for now
  if (session.type === "guest") {
    return emptyCounts;
  }

  const contactVisibilityFilter = await buildExistingDbContactVisibilityFilter(
    session.user,
  );

  let counts: Awaited<ReturnType<typeof loadSidebarCounts>>;

  try {
    counts = await withPrismaRetry(() =>
      loadSidebarCounts(contactVisibilityFilter),
    );
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) {
      throw error;
    }

    console.warn(
      "[CRM sidebar counts] database pool timeout after retry; using empty counts.",
      error instanceof Error ? error.message : error,
    );
    return emptyCounts;
  }

  const [
    opportunities,
    company,
    products,
    contacts,
    leads,
    customers,
    agents,
    others,
    activities,
    aiActivities,
    templates,
  ] = counts;

  return {
    dashboard: opportunities + company + products + contacts + leads,
    opportunities,
    company,
    products,
    contacts,
    leads,
    customers,
    agents,
    others,
    activities,
    aiActivities,
    templates,
  };
}

function loadSidebarCounts(visibilityFilter: Prisma.crm_ContactsWhereInput) {
  return prismadb.$transaction([
    prismadb.crm_Opportunities.count({ where: { deletedAt: null } }),
    prismadb.crm_Accounts.count({ where: { deletedAt: null } }),
    prismadb.crm_Products.count({ where: { deletedAt: null } }),
    prismadb.crm_Contacts.count({
      where: contactCountWhere(visibilityFilter),
    }),
    prismadb.crm_Leads.count({ where: { deletedAt: null } }),
    prismadb.crm_Contacts.count({
      where: contactCountWhere(visibilityFilter, "customer"),
    }),
    prismadb.crm_Contacts.count({
      where: contactCountWhere(visibilityFilter, "agent"),
    }),
    prismadb.crm_Contacts.count({
      where: contactCountWhere(visibilityFilter, "others"),
    }),
    prismadb.crm_Activities.count({ where: { deletedAt: null } }),
    prismadb.crm_RetailAIActivities.count({
      where: { deletedAt: null },
    }),
    prismadb.crm_campaign_templates.count({ where: { deletedAt: null } }),
  ]);
}
