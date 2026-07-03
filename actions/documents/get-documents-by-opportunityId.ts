import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getDocumentsByOpportunityId = async (opportunityId: string) => {
  await requireOrganizationId();
  // Query through DocumentsToOpportunities junction table
  const data = await prismadb.documents.findMany({
    where: {
      opportunities: {
        some: {
          opportunity_id: opportunityId,
        },
      },
    },
    include: {
      created_by: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assigned_to_user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      date_created: "desc",
    },
  });
  return data;
};
