import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getAccount = async (accountId: string) => {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    const data = await prismadb.crm_Accounts.findFirst({
      where: {
        id: accountId,
        organizationId,
        deletedAt: null,
      },
      include: {
        contacts: true,
        opportunities: true,
        // Documents relationship through DocumentsToAccounts junction table
        documents: {
          include: {
            document: {
              select: {
                id: true,
                document_name: true,
                document_type: true,
                document_file_url: true,
                document_file_mimeType: true,
                createdAt: true,
                created_by: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        assigned_to_user: {
          select: {
            name: true,
          },
        },
        industry_type: {
          select: {
            name: true,
          },
        },
        // Watchers relationship through AccountWatchers junction table
        watchers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
    return data;
  });
};
