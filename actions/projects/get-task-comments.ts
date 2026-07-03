import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
/**
 * Fetch comments for a Projects task (`Tasks` model).
 *
 * Projects-module only. CRM account tasks have their own comments loaded
 * via the `comments` relation on `crm_Accounts_Tasks` — do not route them
 * through this function.
 */
export const getTaskComments = async (taskId: string) => {
  await requireOrganizationId();
  const data = await prismadb.tasksComments.findMany({
    where: {
      task: taskId,
    },
    include: {
      assigned_user: {
        select: {
          name: true,
          avatar: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};
