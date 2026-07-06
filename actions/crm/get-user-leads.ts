import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getUserLeads = async (userId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Leads.findMany({
      where: {
        organizationId,
        assigned_to: userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return data;
  });
};
