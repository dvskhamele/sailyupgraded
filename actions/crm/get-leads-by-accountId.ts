import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getLeadsByAccountId = async (accountId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Leads.findMany({
      where: {
        organizationId,
        accountsIDs: accountId,
        deletedAt: null,
      },
      include: {
        assigned_to_user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return data;
  });
};
