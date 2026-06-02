import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

export const getKanbanData = async (boardId: string) => {
  const session = await getSession();
  if (!session?.user.organizationId) {
    return { board: null, sections: [] };
  }

  const board = await prismadb.boards.findFirst({
    where: {
      id: boardId,
      organizationId: session.user.organizationId,
    },
  });
  //console.log(board, "getBoard - board");

  //Select sections from board with boardId, tasks are included
  let sections = await prismadb.sections.findMany({
    where: {
      board: boardId,
      organizationId: session.user.organizationId,
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
