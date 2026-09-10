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

const countsCache = new Map<string, { data: CrmSidebarCounts; timestamp: number }>();
const refreshingKeys = new Set<string>();
const SIDEBAR_CACHE_TTL_MS = 60_000; // 1 minute fresh TTL, served stale-while-revalidate

export async function getCrmSidebarCounts(): Promise<CrmSidebarCounts> {
  const session = await getSession();

  if (!session) {
    return emptyCounts;
  }

  const cacheKey = session.user?.id || "anonymous";
  const cached = countsCache.get(cacheKey);

  // Stale-While-Revalidate: Return cached counts immediately to never block SSR page render
  if (cached) {
    if (Date.now() - cached.timestamp >= SIDEBAR_CACHE_TTL_MS && !refreshingKeys.has(cacheKey)) {
      refreshingKeys.add(cacheKey);
      Promise.resolve().then(async () => {
        try {
          const contactVisibilityFilter = await buildExistingDbContactVisibilityFilter(
            session.user,
          );
          const counts = await withPrismaRetry(() =>
            loadSidebarCounts(contactVisibilityFilter),
          );
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

          const freshResult: CrmSidebarCounts = {
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
          countsCache.set(cacheKey, { data: freshResult, timestamp: Date.now() });
        } catch (err) {
          console.warn("[CRM sidebar counts background refresh]", err);
        } finally {
          refreshingKeys.delete(cacheKey);
        }
      });
    }
    return cached.data;
  }

  const contactVisibilityFilter = await buildExistingDbContactVisibilityFilter(
    session.user,
  );

  let counts: Awaited<ReturnType<typeof loadSidebarCounts>>;

  try {
    // Bound initial cold query to 3000ms so SSR page render is never delayed
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sidebar counts timeout")), 3000)
    );

    counts = await Promise.race([
      withPrismaRetry(() => loadSidebarCounts(contactVisibilityFilter)),
      timeoutPromise,
    ]);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) {
      console.warn(
        "[CRM sidebar counts] initial fetch timed out or error; returning empty counts and updating in background.",
        error instanceof Error ? error.message : error,
      );
    }
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

  const result: CrmSidebarCounts = {
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

  countsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

function loadSidebarCounts(visibilityFilter: Prisma.crm_ContactsWhereInput) {
  return Promise.all([
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
