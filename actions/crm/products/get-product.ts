import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getProduct = cache(async (id: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const product = await prismadb.crm_Products.findFirst({
      where: { id, organizationId },
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
});
