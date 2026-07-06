import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getOpportunitiesFullByContactId = cache(async (contactId: string) => {
  const organizationId = await requireOrganizationId();
  return withPrismaRetry(async () => {
    return runWithOrganizationContext(organizationId, async () => {
      const data = await prismadb.crm_Opportunities.findMany({
        where: {
          organizationId,
          deletedAt: null,
          // Filter through ContactsToOpportunities junction table
          contacts: {
            some: {
              contact_id: contactId,
            },
          },
        },
        include: {
          assigned_account: {
            select: {
              name: true,
            },
          },
          assigned_sales_stage: {
            select: {
              name: true,
            },
          },
          assigned_to_user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          created_on: "desc",
        },
      });

      return serializeDecimalsList(data);
    });
  });
});
