import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getAccounts = cache(async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Accounts.findMany({
      where: {
        organizationId,
        deletedAt: null,
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
        // Watchers relationship through AccountWatchers junction table
        watchers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
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
