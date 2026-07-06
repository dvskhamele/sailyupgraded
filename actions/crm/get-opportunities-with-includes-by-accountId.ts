import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getOpportunitiesFullByAccountId = async (accountId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Opportunities.findMany({
      where: {
        organizationId,
        account: accountId,
        deletedAt: null,
      },
      include: {
        assigned_account: {
          select: {
            name: true,
          },
        },
        assigned_sales_stage: {
          select: {
            name: true,
          },
        },
        assigned_to_user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_on: "desc",
      },
    });

    return data;
  });
};
