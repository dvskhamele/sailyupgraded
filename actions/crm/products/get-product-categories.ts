import { cache } from "react";
import { requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getProductCategories = cache(async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const categories = await prismadb.crm_ProductCategories.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });
    return categories;
  });
});
