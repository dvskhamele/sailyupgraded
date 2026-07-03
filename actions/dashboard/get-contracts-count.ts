import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getContractsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_Contracts.count({ where: { deletedAt: null } });
  return data;
};
