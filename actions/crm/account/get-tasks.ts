import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getAccountsTasks = async (accountId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      account: accountId,
    },
    include: {
      assigned_user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  return data;
};
