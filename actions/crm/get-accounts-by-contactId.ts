import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";

export const getAccountsByContactId = cache(async (contactId: string) => {
  return withPrismaRetry(async () => {
    const data = await prismadb.crm_Accounts.findMany({
      where: {
        deletedAt: null,
        contacts: {
          some: {
            id: contactId,
          },
        },
      },
      include: {
        assigned_to_user: {
          select: {
            name: true,
          },
        },
        contacts: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return data;
  });
});
