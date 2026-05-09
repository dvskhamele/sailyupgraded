import { prismadb } from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

export const getContactsByOpportunityId = async (opportunityId: string) => {
  const select = await getCrmContactListSelect();
  const data = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
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
