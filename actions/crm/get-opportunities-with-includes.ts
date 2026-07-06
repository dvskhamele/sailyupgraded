"use server";

import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

async function loadOpportunitiesFull(organizationId: string) {
  return prismadb.crm_Opportunities.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
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
  const organizationId = await requireOrganizationId();
  return withPrismaRetry(async () => {
    return runWithOrganizationContext(organizationId, async () => {
      return loadOpportunitiesFull(organizationId);
    });
  });
});
