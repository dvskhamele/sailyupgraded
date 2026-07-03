"use server";

import { cache } from "react";
import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getContractsWithIncludes = cache(async () => {
  const data = await prismadb.crm_Contracts.findMany({
    where: { deletedAt: null },
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

export const getContractsByAccountId = async (accountId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Contracts.findMany({
    where: {
      account: accountId,
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
};
