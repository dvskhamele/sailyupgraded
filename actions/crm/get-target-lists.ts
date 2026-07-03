"use server";
import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getTargetLists = async () => {
  await requireOrganizationId();
  const targetLists = await prismadb.crm_TargetLists.findMany({
    where: { deletedAt: null },
    orderBy: { created_on: "desc" },
    include: {
      crate_by_user: { select: { name: true } },
      _count: { select: { targets: true } },
    },
  });
  return targetLists;
};
