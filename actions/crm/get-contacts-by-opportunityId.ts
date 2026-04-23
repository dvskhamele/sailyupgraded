import { prismadb } from "@/lib/prisma";
import { crmContactListSelect } from "@/lib/prisma-contact-select";

export const getContactsByOpportunityId = async (opportunityId: string) => {
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
    select: crmContactListSelect,
  });
  return data;
};
