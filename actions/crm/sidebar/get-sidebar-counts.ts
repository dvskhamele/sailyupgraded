import type { Prisma } from "@prisma/client";

import { requireOrganizationId, getSession } from "@/lib/auth-server";
import { buildContactRoleFilter } from "@/lib/contact-options";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { runWithOrganizationContext } from "@/lib/organization-context";
import { prismadb } from "@/lib/prisma";

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

  const organizationId = session.user.organizationId;

  return runWithOrganizationContext(organizationId, async () => {
    const contactVisibilityFilter = await buildExistingDbContactVisibilityFilter(
      session.user,
    );

    const opportunities = await prismadb.crm_Opportunities.count({
      where: { deletedAt: null },
    });
    const company = await prismadb.crm_Accounts.count({
      where: { deletedAt: null },
    });
    const products = await prismadb.crm_Products.count({
      where: { deletedAt: null },
    });
    const contacts = await prismadb.crm_Contacts.count({
      where: contactCountWhere(contactVisibilityFilter),
    });
    const leads = await prismadb.crm_Leads.count({
      where: { deletedAt: null },
    });
    const customers = await prismadb.crm_Contacts.count({
      where: contactCountWhere(contactVisibilityFilter, "customer"),
    });
    const agents = await prismadb.crm_Contacts.count({
      where: contactCountWhere(contactVisibilityFilter, "agent"),
    });
    const others = await prismadb.crm_Contacts.count({
      where: contactCountWhere(contactVisibilityFilter, "others"),
    });
    const activities = await prismadb.crm_Activities.count({
      where: { deletedAt: null },
    });
    const aiActivities = await prismadb.crm_RetailAIActivities.count({
      where: { deletedAt: null },
    });
    const templates = await prismadb.crm_campaign_templates.count({
      where: { deletedAt: null },
    });

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
  });
}