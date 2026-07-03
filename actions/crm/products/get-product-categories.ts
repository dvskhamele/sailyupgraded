import { cache } from "react";
import { requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export const getProductCategories = cache(async () => {
  await requireOrganizationId();
  const categories = await prismadb.crm_ProductCategories.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  return categories;
});
