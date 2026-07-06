import { cache } from "react";

import { requireOrganizationId } from "@/lib/auth-server";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getProductsByContactId = cache(async (contactId: string) => {
  const organizationId = await requireOrganizationId();
  return withPrismaRetry(async () => {
    return runWithOrganizationContext(organizationId, async () => {
      const assignments = await prismadb.crm_AccountProducts.findMany({
        where: {
          organizationId,
          account: {
            organizationId,
            deletedAt: null,
            contacts: {
              some: { id: contactId },
            },
          },
        },
        select: {
          id: true,
          accountId: true,
          productId: true,
          quantity: true,
          custom_price: true,
          currency: true,
          status: true,
          start_date: true,
          end_date: true,
          renewal_date: true,
          notes: true,
          createdAt: true,
          account: {
            select: {
              id: true,
              name: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              type: true,
              status: true,
              unit_price: true,
              currency: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });

      return serializeDecimals(assignments);
    });
  });
});
