import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getCampaigns = async () => {
  await requireOrganizationId();
  const data = await prismadb.crm_campaigns.findMany({});
  return data;
};
