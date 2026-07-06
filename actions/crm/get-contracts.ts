"use server";

import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getContractsWithIncludes = cache(async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Contracts.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        assigned_to_user: {
          select: {
            name: true,
          },
        },
        assigned_account: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return data;
  });
});

export const getContractsByAccountId = async (accountId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Contracts.findMany({
      where: {
        account: accountId,
        organizationId,
        deletedAt: null,
      },
      include: {
        assigned_to_user: {
          select: {
            name: true,
          },
        },
        assigned_account: {
          select: {
            name: true,
          },
        },
      },
    });
    return data;
  });
};
