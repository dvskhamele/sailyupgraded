import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getLeadsByAccountId = async (accountId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Leads.findMany({
    where: {
      accountsIDs: accountId,
      deletedAt: null,
    },
    include: {
      assigned_to_user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};
