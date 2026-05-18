import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

export const getContactsByAccountId = async (accountId: string) => {
  const session = await getSession();
  if (!session) return [];

  const select = await getCrmContactListSelect();
  const data = await prismadb.crm_Contacts.findMany({
    where: {
      accountsIDs: accountId,
      deletedAt: null,
      ...(await buildExistingDbContactVisibilityFilter(session.user)),
    },
    select,
  });
  return serializeDecimalsList(data);
};
