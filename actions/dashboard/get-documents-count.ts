import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getDocumentsCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.documents.count();
  return data;
};
