"use server";

import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export async function getContactAccountOptions() {
  await requireOrganizationId();
  return prismadb.crm_Accounts.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}
