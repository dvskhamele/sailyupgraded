import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getAccountsByContactId = cache(async (contactId: string) => {
  const organizationId = await requireOrganizationId();
  return withPrismaRetry(async () => {
    return runWithOrganizationContext(organizationId, async () => {
      const data = await prismadb.crm_Accounts.findMany({
        where: {
          organizationId,
          deletedAt: null,
          contacts: {
            some: {
              id: contactId,
            },
          },
        },
        include: {
          assigned_to_user: {
            select: {
              name: true,
            },
          },
          contacts: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return data;
    });
  });
});
