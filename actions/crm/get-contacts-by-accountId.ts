import { prismadb } from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";

export const getContactsByAccountId = async (accountId: string) => {
  const select = await getCrmContactListSelect();
  const data = await prismadb.crm_Contacts.findMany({
    where: {
      accountsIDs: accountId,
      deletedAt: null,
    },
    select,
  });
  return data;
};
