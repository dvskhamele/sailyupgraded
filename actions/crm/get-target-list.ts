"use server";
import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getTargetList = async (id: string) => {
  await requireOrganizationId();
  const targetList = await prismadb.crm_TargetLists.findUnique({
    where: { id },
    include: {
      crate_by_user: { select: { name: true } },
      targets: { include: { target: true } },
    },
  });
  return targetList;
};
