"use server";
import { prismadb } from "@/lib/prisma";
import { normalizeUtcDate } from "@/lib/campaigns/scheduling";

export const updateCampaign = async (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    from_name: string;
    reply_to: string;
    template_id: string;
    scheduled_at: Date;
  }>
) => {
  return prismadb.crm_campaigns.update({
    where: { id },
    data: {
      ...data,
      scheduled_at: data.scheduled_at ? normalizeUtcDate(data.scheduled_at) : undefined,
    },
  });
};
