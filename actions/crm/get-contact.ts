import { prismadb } from "@/lib/prisma";
import { getCrmContactDetailSelect } from "@/lib/prisma-contact-select";

export const getContact = async (contactId: string) => {
  const select = await getCrmContactDetailSelect();
  const data = await prismadb.crm_Contacts.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
    },
    select,
  });
  return data;
};
