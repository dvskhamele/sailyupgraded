import { prismadb } from "@/lib/prisma";

export const getSalesType = async () => {
  const data = await prismadb.crm_Opportunities_Type.findMany({
    orderBy: { order: "asc" }
  });
  return data;
};
