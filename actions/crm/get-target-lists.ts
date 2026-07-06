"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getTargetLists = async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const targetLists = await prismadb.crm_TargetLists.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { created_on: "desc" },
      include: {
        crate_by_user: { select: { name: true } },
        _count: { select: { targets: true } },
      },
    });
    return targetLists;
  });
};
