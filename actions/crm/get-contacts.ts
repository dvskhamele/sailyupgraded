import { cache } from "react";
import { prismadb } from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildContactRoleFilter } from "@/lib/contact-options";

export const getContacts = cache(async (role?: string) => {
  const select = await getCrmContactListSelect();
  const data = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
      ...buildContactRoleFilter(role),
    },
    select,
  });
  return data;
});
