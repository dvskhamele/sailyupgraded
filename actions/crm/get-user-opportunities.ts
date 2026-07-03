import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getUserOpportunities = async (userId: string) => {
  await requireOrganizationId();
  const data = await prismadb.crm_Opportunities.findMany({
    where: {
      assigned_to: userId,
      deletedAt: null,
    },
    include: {
      assigned_sales_stage: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};
