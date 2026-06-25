"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { DeleteTeamSchema } from "./types";
import { z } from "zod";

export const deleteTeam = async (data: z.infer<typeof DeleteTeamSchema>) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = DeleteTeamSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(", ") };
  }

  const { id } = validated.data;

  try {
    const before = await prismadb.crm_Teams.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Team not found" };

    const team = await prismadb.crm_Teams.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    });

    await writeAuditLog({
      entityType: "team",
      entityId: team.id,
      action: "deleted",
      userId: session.user.id,
    });

    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    return { data: team };
  } catch (error) {
    console.error("[DELETE_TEAM]", error);
    return { error: "Failed to delete team" };
  }
};
