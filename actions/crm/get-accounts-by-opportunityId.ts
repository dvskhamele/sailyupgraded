import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getAccountsByOpportunityId = async (opportunityId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Accounts.findMany({
      where: {
        organizationId,
        deletedAt: null,
        opportunities: {
          some: {
            id: opportunityId,
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
};
