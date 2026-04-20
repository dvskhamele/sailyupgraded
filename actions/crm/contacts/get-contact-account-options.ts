"use server";

import { prismadb } from "@/lib/prisma";

export async function getContactAccountOptions() {
  return prismadb.crm_Accounts.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}
