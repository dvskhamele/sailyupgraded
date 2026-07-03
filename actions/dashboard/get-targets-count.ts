import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getTargetsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_Targets.count();
  return data;
};
