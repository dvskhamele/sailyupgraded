import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";

export const getContactCount = async () => {
  const session = await getSession();
  if (!session) return 0;

  const data = await prismadb.crm_Contacts.count({
    where: {
      deletedAt: null,
      ...(await buildExistingDbContactVisibilityFilter(session.user)),
    },
  });
  return data;
};
