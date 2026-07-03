import { requireOrganizationId } from "@/lib/auth-server";
import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  resetPrisma,
} from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";

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

async function loadOpportunities() {
  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: { deletedAt: null },
    include: {
      // Include assigned user (uses "assigned_to_user_relation")
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
      // Include created by user (uses "created_by_user_relation")
      created_by_user: {
        select: {
          name: true,
        },
      },
      // Include contacts through ContactsToOpportunities junction table
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
      // Include documents through DocumentsToOpportunities junction table
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
        .filter((contactId): contactId is string => Boolean(contactId)),
    ),
  ];

  if (assignedClientIds.length === 0) {
    return opportunities;
  }

  const assignedClientContacts = await prismadb.crm_Contacts.findMany({
    where: {
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
    assignedClientContacts.map((contact) => [contact.id, contact]),
  );

  return opportunities.map((opportunity) => ({
    ...opportunity,
    assignedClientContact: opportunity.contact
      ? assignedClientContactsById.get(opportunity.contact) ?? null
      : null,
  }));
}

export const getOpportunities = async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    if (bypassLogin) {
      return [];
    }

    try {
      return await loadOpportunities();
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
      return loadOpportunities();
    }
  });
};

//Get opportunities by month for chart
export const getOpportunitiesByMonth = async () => {
  await requireOrganizationId();
  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: { deletedAt: null },
    select: {
      created_on: true,
    },
  });

  if (!opportunities) {
    return {};
  }

  const opportunitiesByMonth = opportunities.reduce(
    (acc: any, opportunity: any) => {
      const month = new Date(opportunity.created_on).toLocaleString("default", {
        month: "long",
      });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    },
    {}
  );

  const chartData = Object.keys(opportunitiesByMonth).map((month: any) => {
    return {
      name: month,
      Number: opportunitiesByMonth[month],
    };
  });

  return chartData;
};

//Get opportunities by sales_stage name for chart
export const getOpportunitiesByStage = async () => {
  await requireOrganizationId();
  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: { deletedAt: null },
    select: {
      assigned_sales_stage: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log(opportunities, "opportunities");
  if (!opportunities) {
    return {};
  }

  const opportunitiesByStage = opportunities.reduce(
    (acc: any, opportunity: any) => {
      const stage = opportunity.assigned_sales_stage?.name;
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    },
    {}
  );

  const chartData = Object.keys(opportunitiesByStage).map((stage: any) => {
    return {
      name: stage,
      Number: opportunitiesByStage[stage],
    };
  });

  return chartData;
};
