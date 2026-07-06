"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getAccounts = async () => {
  const organizationId = await requireOrganizationId();
  try {
    const accounts = await runWithOrganizationContext(organizationId, async () => {
      return prismadb.crm_Accounts.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    });
    return { data: accounts };
  } catch (error) {
    return { error: "Failed to fetch accounts" };
  }
};
