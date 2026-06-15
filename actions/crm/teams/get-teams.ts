"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export const getTeams = async () => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    const teams = await prismadb.crm_Teams.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
    return { data: teams };
  } catch (error) {
    console.error("[GET_TEAMS]", error);
    return { error: "Failed to get teams" };
  }
};
