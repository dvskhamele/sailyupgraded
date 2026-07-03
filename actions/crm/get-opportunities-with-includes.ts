"use server";

import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
async function loadOpportunitiesFull() {
  await requireOrganizationId();
  return prismadb.crm_Opportunities.findMany({
    where: { deletedAt: null },
    include: {
      assigned_account: {
        select: {
          name: true,
        },
      },
      assigned_sales_stage: {
        select: {
          name: true,
        },
      },
      assigned_to_user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      created_on: "desc",
    },
  });
}

export const getOpportunitiesFull = cache(async () => {
  return withPrismaRetry(loadOpportunitiesFull);
});
