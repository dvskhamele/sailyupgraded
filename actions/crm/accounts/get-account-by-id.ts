"use server";

import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export async function getAccountById(accountId: string) {
  await requireOrganizationId();
  const account = await prismadb.crm_Accounts.findFirst({
    where: { id: accountId, deletedAt: null },
    select: { id: true, name: true },
  });

  return account ?? null;
}
