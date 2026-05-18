import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

export const getContactsByOpportunityId = async (opportunityId: string) => {
  const session = await getSession();
  if (!session) return [];

  const select = await getCrmContactListSelect();
  const data = await prismadb.crm_Contacts.findMany({
    where: {
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
};
