"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getTargets = async () => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const targets = await prismadb.crm_Targets.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { created_on: "desc" },
      include: {
        crate_by_user: { select: { name: true } },
        target_lists: { include: { target_list: { select: { id: true, name: true } } } },
      },
    });
    return targets;
  });
};
