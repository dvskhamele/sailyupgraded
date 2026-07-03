"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { inngest } from "@/inngest/client";

export const sendCampaignNow = async (id: string) => {
  await requireOrganizationId();
  const now = new Date();
  await prismadb.crm_campaigns.update({
    where: { id },
    data: { status: "sending", scheduled_at: now },
  });

  await inngest.send({
    name: "campaigns/send-now",
    data: { campaignId: id },
  });
};
