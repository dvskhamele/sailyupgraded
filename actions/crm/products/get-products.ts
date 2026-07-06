import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getProductsFull = cache(async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const products = await prismadb.crm_Products.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        category: true,
        created_by_user: { select: { id: true, name: true } },
        _count: { select: { accountProducts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return products;
  });
});
