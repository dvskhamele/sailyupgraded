"use server";
import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getContract = async (contractId: string) => {
  await requireOrganizationId();
  return prismadb.crm_Contracts.findUnique({
    where: { id: contractId, deletedAt: null },
    include: {
      assigned_account: { select: { id: true, name: true } },
      assigned_to_user: { select: { id: true, name: true } },
      lineItems: {
        include: {
          product: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { sort_order: "asc" },
      },
    },
  });
};
