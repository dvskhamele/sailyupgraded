import { cache } from "react";
import { requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export const getOpportunityLineItems = cache(async (opportunityId: string) => {
  await requireOrganizationId();
  return prismadb.crm_OpportunityLineItems.findMany({
    where: { opportunityId },
    include: {
      product: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { sort_order: "asc" },
  });
});
