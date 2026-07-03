import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getUserTasks = async (userId: string) => {
  await requireOrganizationId();
  const data = await prismadb.tasks.findMany({
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
