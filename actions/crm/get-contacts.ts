import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildContactRoleFilter } from "@/lib/contact-options";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getContacts = async (role?: string) => {
  const loadContacts = async () => {
    const session = await getSession();
    if (!session) return [];

    const organizationId = await requireOrganizationId();
    const select = await getCrmContactListSelect();
    const contacts = await prismadb.crm_Contacts.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...buildContactRoleFilter(role),
        ...(await buildExistingDbContactVisibilityFilter(session?.user)),
      },
      select,
    });

    return serializeDecimalsList(contacts);
  };

  try {
    const organizationId = await requireOrganizationId();
    return await withPrismaRetry(async () => {
      return runWithOrganizationContext(organizationId, loadContacts);
    });
  } catch (error) {
    if (!isTransientPrismaConnectionError(error) && !isPrismaAccessDeniedError(error)) {
      throw error;
    }

    console.warn("[Contacts] database unavailable; rendering empty contact list.");
    return [];
  }
};
