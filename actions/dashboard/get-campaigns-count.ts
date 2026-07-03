import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getCampaignsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_campaigns.count();
  return data;
};
