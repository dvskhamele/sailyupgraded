"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getContract = async (contractId: string) => {
  const organizationId = await requireOrganizationId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Contracts.findFirst({
      where: { id: contractId, organizationId, deletedAt: null },
      include: {
        assigned_account: { select: { id: true, name: true } },
        assigned_to_user: { select: { id: true, name: true } },
        lineItems: {
          include: {
            product: {
              select: { id: true, name: true, status: true },
            },
          },
          orderBy: { sort_order: "asc" },
        },
      },
    });
  });
};
