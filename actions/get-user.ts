import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

export const getUser = async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  if (!session.user.organizationId) {
    throw new Error("Organization context is required");
  }

  const data = await prismadb.users.findUnique({
    where: {
      id: session.user.id,
    },
  });
  if (!data) throw new Error("User not found");
  return {
    ...data,
    organizationId: session.user.organizationId,
    organizationRole: session.user.organizationRole,
  };
};
