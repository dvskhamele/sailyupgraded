import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getAccountsByOpportunityId = async (opportunityId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Accounts.findMany({
    where: {
      deletedAt: null,
      opportunities: {
        some: {
          id: opportunityId,
        },
      },
    },
    include: {
      assigned_to_user: {
        select: {
          name: true,
        },
      },
      contacts: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};
