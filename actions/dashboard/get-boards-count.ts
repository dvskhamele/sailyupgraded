import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getBoardsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.boards.count();
  return data;
};
