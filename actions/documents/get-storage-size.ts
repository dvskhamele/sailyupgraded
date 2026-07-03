import { prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
export const getStorageSize = async () => {
  await requireOrganizationId();
  const data = await prismadb.documents.findMany({});

  //TODO: fix this any
  const storageSize = data.reduce((acc: number, doc: any) => {
    return acc + doc?.size;
  }, 0);

  const storageSizeMB = storageSize / 1000000;

  return Math.round(storageSizeMB * 100) / 100;
};
