import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getCrMTask = async (taskId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Accounts_Tasks.findFirst({
    where: {
      id: taskId,
    },
    include: {
      assigned_user: {
        select: {
          id: true,
          name: true,
        },
      },
      // Include documents through DocumentsToCrmAccountsTasks junction table
      documents: {
        include: {
          document: {
            select: {
              id: true,
              document_name: true,
              document_file_url: true,
              document_file_mimeType: true,
              assigned_to_user: {
                select: {
                  name: true,
                },
              },
              created_by: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      comments: {
        select: {
          id: true,
          comment: true,
          createdAt: true,
          assigned_user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
    },
  });
  return data;
};
