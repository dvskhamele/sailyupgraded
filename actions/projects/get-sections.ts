import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getSections = async () => {
  await requireOrganizationId();
  const data = await prismadb.sections.findMany({});

  return data;
};
