"use server";

import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export async function getAccountById(accountId: string) {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const account = await prismadb.crm_Accounts.findFirst({
      where: { id: accountId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });

    return account ?? null;
  });
}
