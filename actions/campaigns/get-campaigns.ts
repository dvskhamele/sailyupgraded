"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { sortCampaignQueue } from "@/lib/campaigns/scheduling";

export const getCampaigns = async (filters?: { status?: string; search?: string }) => {
  await requireOrganizationId();
  const campaigns = await prismadb.crm_campaigns.findMany({
    where: {
      status: { not: "deleted" },
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search ? { name: { contains: filters.search } } : {}),
    },
    orderBy: [{ scheduled_at: "asc" }, { created_on: "asc" }, { id: "asc" }],
    include: {
      template: { select: { name: true } },
      created_by_user: { select: { name: true } },
      _count: { select: { sends: true } },
    },
  });

  return sortCampaignQueue(campaigns);
};
