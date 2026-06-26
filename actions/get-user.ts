import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

export const getUser = async () => {
  const session = await getSession();
  
  if (session?.type === "guest") {
    // Return mock guest user
    return {
      id: "guest-user",
      created_on: new Date(),
      updated_at: new Date(),
      email: "guest@example.com",
      name: "Guest User",
      role: "admin",
      userStatus: "ACTIVE",
      userLanguage: "en",
      image: null,
      avatar: null,
      banned: false,
      emailVerified: true,
    };
  }

  if (session?.type !== "user") {
    throw new Error("User not found");
  }

  const data = await prismadb.users.findUnique({
    where: {
      id: session.user.id,
    },
  });
  if (!data) throw new Error("User not found");
  return data;
};
