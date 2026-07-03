import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getTaskDocuments = async (taskId: string) => {
  await requireOrganizationId();
  // Query documents through DocumentsToTasks junction table
  const data = await prismadb.documents.findMany({
    where: {
      tasks: {
        some: {
          task_id: taskId,
        },
      },
    },
    include: {
      created_by: {
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
  });
  return data;
};
