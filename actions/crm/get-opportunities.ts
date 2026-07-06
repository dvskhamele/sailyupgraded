import { requireOrganizationId } from "@/lib/auth-server";
import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  resetPrisma,
  withPrismaRetry,
} from "@/lib/prisma";
import { runWithOrganizationContext, getOrganizationContext } from "@/lib/organization-context";

const bypassLogin =
  process.env.BYPASS_LOGIN === "true" ||
  process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

function isEndedPoolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("pool is ending");
}

function shouldUseFallback(error: unknown) {
  return isPrismaAccessDeniedError(error) || isTransientPrismaConnectionError(error);
}

async function loadOpportunities(organizationId: string) {
  console.log("[loadOpportunities] async context org id:", getOrganizationContext());
  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    include: {
      assigned_to_user: {
        select: {
          avatar: true,
          name: true,
        },
      },
      assigned_account: {
        select: {
          name: true,
        },
      },
      created_by_user: {
        select: {
          name: true,
        },
      },
      contacts: {
        include: {
          contact: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              personal_email: true,
              phone: true,
              mobile_phone: true,
              office_phone: true,
              state: true,
            },
          },
        },
      },
      documents: {
        include: {
          document: {
            select: {
              id: true,
              document_name: true,
            },
          },
        },
      },
    },
  });

  const assignedClientIds = [
    ...new Set(
      opportunities
        .map((opportunity) => opportunity.contact)
        .filter((contactId): contactId is string => Boolean(contactId))
    ),
  ];

  if (assignedClientIds.length === 0) {
    return opportunities;
  }

  const assignedClientContacts = await prismadb.crm_Contacts.findMany({
    where: {
      organizationId,
      id: { in: assignedClientIds },
      deletedAt: null,
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      personal_email: true,
      phone: true,
      mobile_phone: true,
      office_phone: true,
      state: true,
    },
  });

  const assignedClientContactsById = new Map(
    assignedClientContacts.map((contact) => [contact.id, contact])
  );

  return opportunities.map((opportunity) => ({
    ...opportunity,
    assignedClientContact: opportunity.contact
      ? assignedClientContactsById.get(opportunity.contact) ?? null
      : null,
  }));
}

export const getOpportunities = async () => {
  if (bypassLogin) {
    return [];
  }

  const organizationId = await requireOrganizationId();

  try {
    return await withPrismaRetry(async () => {
      return await runWithOrganizationContext(organizationId, async () => {
        return await loadOpportunities(organizationId);
      });
    });
  } catch (error) {
    if (shouldUseFallback(error)) {
      console.warn(
        "[CRM] getOpportunities failed; using local fallback data.",
        error instanceof Error ? error.message : error,
      );

      return [];
    }

    if (!isEndedPoolError(error)) {
      throw error;
    }

    await resetPrisma();
    return await runWithOrganizationContext(organizationId, async () => {
      return await loadOpportunities(organizationId);
    });
  }
};

// Get opportunities by month for chart
export const getOpportunitiesByMonth = async () => {
  if (bypassLogin) {
    return [];
  }

  const organizationId = await requireOrganizationId();

  return await withPrismaRetry(async () => {
    return await runWithOrganizationContext(organizationId, async () => {
      console.log("[getOpportunitiesByMonth] async context org id:", getOrganizationContext());
      const opportunities = await prismadb.crm_Opportunities.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          created_on: true,
        },
      });

      const opportunitiesByMonth = opportunities.reduce(
        (acc: Record<string, number>, opportunity) => {
          if (!opportunity.created_on) {
            return acc;
          }

          const month = new Date(opportunity.created_on).toLocaleString("default", {
            month: "long",
          });

          acc[month] = (acc[month] || 0) + 1;
          return acc;
        },
        {}
      );

      const chartData = Object.keys(opportunitiesByMonth).map((month) => ({
        name: month,
        Number: opportunitiesByMonth[month],
      }));

      return chartData;
    });
  });
};

// Get opportunities by sales_stage name for chart
export const getOpportunitiesByStage = async () => {
  if (bypassLogin) {
    return [];
  }

  const organizationId = await requireOrganizationId();

  return await withPrismaRetry(async () => {
    return await runWithOrganizationContext(organizationId, async () => {
      console.log("[getOpportunitiesByStage] async context org id:", getOrganizationContext());
      const opportunities = await prismadb.crm_Opportunities.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          assigned_sales_stage: {
            select: {
              name: true,
            },
          },
        },
      });

      const opportunitiesByStage = opportunities.reduce(
        (acc: Record<string, number>, opportunity) => {
          const stage = opportunity.assigned_sales_stage?.name ?? "Unknown";
          acc[stage] = (acc[stage] || 0) + 1;
          return acc;
        },
        {}
      );

      const chartData = Object.keys(opportunitiesByStage).map((stage) => ({
        name: stage,
        Number: opportunitiesByStage[stage],
      }));

      return chartData;
    });
  });
};