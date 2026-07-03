import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getUserCRMTasks = async (userId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Accounts_Tasks.findMany({
    where: {
      user: userId,
    },
    include: {
      assigned_user: {
        select: {
          id: true,
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
