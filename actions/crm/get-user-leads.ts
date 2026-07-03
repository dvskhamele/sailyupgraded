import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getUserLeads = async (userId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Leads.findMany({
    where: {
      assigned_to: userId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};
