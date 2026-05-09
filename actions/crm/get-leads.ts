import { cache } from "react";
import { prismadb } from "@/lib/prisma";

export const getLeads = cache(async () => {
  const data = await prismadb.crm_Leads.findMany({
    where: { deletedAt: null },
    include: {
      // Include assigned user (uses "LeadAssignedTo" relation)
      assigned_to_user: {
        select: {
          name: true,
        },
      },
      // Include assigned accounts
      assigned_accounts: {
        include: {
          accountProducts: {
            where: { status: "ACTIVE" },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      // Include lead source, status, type
      contact_type: true,
      lead_source: true,
      lead_status: true,
      lead_type: true,
      // Include documents through DocumentsToLeads junction table
      documents: {
        include: {
          document: {
            select: {
              id: true,
              document_name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
});
