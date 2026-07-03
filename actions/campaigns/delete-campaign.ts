"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const deleteCampaign = async (id: string) => {
  await requireOrganizationId();
  return prismadb.crm_campaigns.update({ where: { id }, data: { status: "deleted" } });
};
