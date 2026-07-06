import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getUserOpportunities = async (userId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Opportunities.findMany({
      where: {
        organizationId,
        assigned_to: userId,
        deletedAt: null,
      },
      include: {
        assigned_sales_stage: {
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
