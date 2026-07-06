"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getTargetList = async (id: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const targetList = await prismadb.crm_TargetLists.findFirst({
      where: { id, organizationId },
      include: {
        crate_by_user: { select: { name: true } },
        targets: { include: { target: true } },
      },
    });
    return targetList;
  });
};
