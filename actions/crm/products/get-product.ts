import { cache } from "react";
import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getProduct = cache(async (id: string) => {
  await requireOrganizationId();
  const product = await prismadb.crm_Products.findUnique({
    where: { id },
    include: {
      category: true,
      created_by_user: { select: { id: true, name: true } },
      accountProducts: {
        include: { account: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return product;
});
