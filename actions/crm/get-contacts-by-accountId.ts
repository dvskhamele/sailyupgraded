import { prismadb } from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getContactsByAccountId = async (accountId: string) => {
  const organizationId = await requireOrganizationId();
  const session = await getSession();
  if (!session) return [];

  return runWithOrganizationContext(organizationId, async () => {
    const select = await getCrmContactListSelect();
    const data = await prismadb.crm_Contacts.findMany({
      where: {
        organizationId,
        accountsIDs: accountId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select,
    });
    return serializeDecimalsList(data);
  });
};
