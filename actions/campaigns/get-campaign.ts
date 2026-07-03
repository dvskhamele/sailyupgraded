"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getCampaign = async (id: string) => {
  await requireOrganizationId();
  return prismadb.crm_campaigns.findUnique({
    where: { id },
    include: {
      template: true,
      steps: {
        orderBy: { order: "asc" },
        include: {
          template: true,
          sends: {
            select: {
              status: true,
              opened_at: true,
              clicked_at: true,
              unsubscribed_at: true,
            },
          },
        },
      },
      target_lists: { include: { target_list: { select: { id: true, name: true } } } },
      sends: {
        include: { target: { select: { first_name: true, last_name: true } } },
        orderBy: { sent_at: "desc" },
      },
    },
  });
};
