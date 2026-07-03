"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getTemplates = async () => {
  await requireOrganizationId();
  return prismadb.crm_campaign_templates.findMany({
    where: { deletedAt: null },
    orderBy: { created_on: "desc" },
    include: { created_by_user: { select: { name: true } } },
  });
};
