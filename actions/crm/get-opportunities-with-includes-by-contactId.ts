import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

export const getOpportunitiesFullByContactId = cache(async (contactId: string) => {
  return withPrismaRetry(async () => {
    const data = await prismadb.crm_Opportunities.findMany({
      where: {
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
