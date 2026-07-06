import { cache } from "react";
import { requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getAccountProducts = cache(async (accountId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const assignments = await prismadb.crm_AccountProducts.findMany({
      where: {
        accountId,
        organizationId,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, type: true, status: true, unit_price: true, unit: true, is_recurring: true, billing_period: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return assignments;
  });
});
