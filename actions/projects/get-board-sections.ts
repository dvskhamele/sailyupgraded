import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getBoardSections = async (boadId: string) => {
  await requireOrganizationId();
  const data = await prismadb.sections.findMany({
    where: {
      board: boadId,
    },
  });

  return data;
};
