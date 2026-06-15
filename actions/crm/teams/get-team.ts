"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export const getTeam = async (id: string) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    const team = await prismadb.crm_Teams.findUnique({
      where: { id, deletedAt: null },
      include: {
        members: true,
        _count: { select: { members: true } },
      },
    });
    if (!team) return { error: "Team not found" };

    return { data: team };
  } catch (error) {
    console.error("[GET_TEAM]", error);
    return { error: "Failed to get team" };
  }
};
