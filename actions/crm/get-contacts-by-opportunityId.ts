import { prismadb } from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { runWithOrganizationContext } from "@/lib/organization-context";

export const getContactsByOpportunityId = async (opportunityId: string) => {
  const organizationId = await requireOrganizationId();
  const session = await getSession();
  if (!session) return [];

  return runWithOrganizationContext(organizationId, async () => {
    const select = await getCrmContactListSelect();
    const data = await prismadb.crm_Contacts.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
        // Filter through ContactsToOpportunities junction table
        opportunities: {
          some: {
            opportunity_id: opportunityId,
          },
        },
      },
      select,
    });
    return serializeDecimalsList(data);
  });
};
