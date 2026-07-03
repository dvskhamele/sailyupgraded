import { prismadb } from "@/lib/prisma";
import { junctionTableHelpers } from "@/lib/junction-helpers";

import { requireOrganizationId } from "@/lib/auth-server";
export const getBoards = async (userId: string) => {
  await requireOrganizationId();
  if (!userId) {
    return null;
  }
  const data = await prismadb.boards.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          user: userId,
        },
        {
          visibility: "public",
        },
        // Find boards where user is a watcher using BoardWatchers junction table
        junctionTableHelpers.watchedByUser(userId),
      ],
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
    orderBy: {
      updatedAt: "desc",
    },
  });
  return data;
};
