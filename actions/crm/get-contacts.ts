import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { crmContactListSelect } from "@/lib/prisma-contact-select";

export const getContacts = cache(async () => {
  const data = await prismadb.crm_Contacts.findMany({
    where: { deletedAt: null },
    select: crmContactListSelect,
  });
  return data;
});
