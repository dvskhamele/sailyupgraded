import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getAccountsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_Accounts.count({ where: { deletedAt: null } });
  return data;
};
