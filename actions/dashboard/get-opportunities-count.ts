import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getOpportunitiesCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_Opportunities.count({ where: { deletedAt: null } });
  return data;
};
