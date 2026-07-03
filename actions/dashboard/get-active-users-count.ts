import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getActiveUsersCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.users.count({
    where: {
      userStatus: "ACTIVE",
    },
  });
  return data;
};
