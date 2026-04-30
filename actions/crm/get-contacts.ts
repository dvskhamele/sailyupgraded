import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";

export const getContacts = cache(async () => {
  const select = await getCrmContactListSelect();
  const data = await prismadb.crm_Contacts.findMany({
    where: { deletedAt: null },
    select,
  });
  return data;
});
