import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getLeadsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_Leads.count({ where: { deletedAt: null } });
  return data;
};
