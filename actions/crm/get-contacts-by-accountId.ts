import { prismadb } from "@/lib/prisma";
import { crmContactListSelect } from "@/lib/prisma-contact-select";

export const getContactsByAccountId = async (accountId: string) => {
  const data = await prismadb.crm_Contacts.findMany({
    where: {
      accountsIDs: accountId,
      deletedAt: null,
    },
    select: crmContactListSelect,
  });
  return data;
};
