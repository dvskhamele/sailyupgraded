import { prismadb } from "@/lib/prisma";
import { crmContactDetailSelect } from "@/lib/prisma-contact-select";

export const getContact = async (contactId: string) => {
  const data = await prismadb.crm_Contacts.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
    },
    select: crmContactDetailSelect,
  });
  return data;
};
