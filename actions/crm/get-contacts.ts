import { cache } from "react";
import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildContactRoleFilter } from "@/lib/contact-options";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

export const getContacts = cache(async (role?: string) => {
  const loadContacts = async () => {
    const select = await getCrmContactListSelect();
    const contacts = await prismadb.crm_Contacts.findMany({
      where: {
        deletedAt: null,
        ...buildContactRoleFilter(role),
      },
      select,
    });

    return serializeDecimalsList(contacts);
  };

  try {
    return await withPrismaRetry(loadContacts);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error) && !isPrismaAccessDeniedError(error)) {
      throw error;
    }

    console.warn("[Contacts] database unavailable; rendering empty contact list.");
    return [];
  }
});
