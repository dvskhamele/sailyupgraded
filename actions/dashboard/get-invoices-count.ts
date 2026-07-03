import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getInvoicesCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.invoices.count();
  return data;
};
