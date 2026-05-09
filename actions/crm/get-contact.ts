import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { getCrmContactDetailSelect } from "@/lib/prisma-contact-select";
import { serializeDecimals } from "@/lib/serialize-decimals";

export const getContact = cache(async (contactId: string) => {
  return withPrismaRetry(async () => {
    const select = await getCrmContactDetailSelect();
    const data = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
      },
      select,
    });

    return data ? serializeDecimals(data) : data;
  });
});
