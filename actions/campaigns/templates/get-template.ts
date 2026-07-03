"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getTemplate = async (id: string) => {
  await requireOrganizationId();
  return prismadb.crm_campaign_templates.findFirst({
    where: { id, deletedAt: null },
    include: { created_by_user: { select: { name: true } } },
  });
};
