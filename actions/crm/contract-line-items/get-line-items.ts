import { cache } from "react";
import { requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export const getContractLineItems = cache(async (contractId: string) => {
  await requireOrganizationId();
  return prismadb.crm_ContractLineItems.findMany({
    where: { contractId },
    include: {
      product: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { sort_order: "asc" },
  });
});
