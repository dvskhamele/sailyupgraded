import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getDocumentsByContactId = cache(async (contactId: string) => {
  await requireOrganizationId();
  return withPrismaRetry(async () => {
    // Query through DocumentsToContacts junction table
    const data = await prismadb.documents.findMany({
      where: {
        contacts: {
          some: {
            contact_id: contactId,
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
  });
});
