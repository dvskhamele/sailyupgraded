import { prismadb } from "@/lib/prisma";
import { junctionTableHelpers, extractWatcherUsers } from "@/lib/junction-helpers";

import { requireOrganizationId } from "@/lib/auth-server";
export const getBoard = async (id: string) => {
  await requireOrganizationId();
  const board = await prismadb.boards.findFirst({
    where: {
      id: id,
      deletedAt: null,
    },
    include: {
      assigned_user: {
        select: {
          name: true,
        },
      },
      // Include watchers through BoardWatchers junction table
      ...junctionTableHelpers.includeWatchersWithUsers(),
    },
  });

  const sections = await prismadb.sections.findMany({
    where: {
      board: id,
    },
    orderBy: {
      position: "asc",
    },
    include: {
      tasks: {
        orderBy: {
          position: "desc",
        },
      },
    },
  });

  const data = {
    board,
    sections,
  };
  return data;
};
