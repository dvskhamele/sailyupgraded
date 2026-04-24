"use server";

import { prismadb } from "@/lib/prisma";

export const getContactFormOptions = async () => {
  const [accounts, contactTypes] = await Promise.all([
    prismadb.crm_Accounts.findMany({ 
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prismadb.crm_Contact_Types.findMany({ 
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
  ]);

  return { accounts, contactTypes };
};
