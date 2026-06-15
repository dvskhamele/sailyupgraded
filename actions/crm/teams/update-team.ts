"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import { UpdateTeamSchema } from "./types";
import { z } from "zod";

export const updateTeam = async (data: z.infer<typeof UpdateTeamSchema>) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = UpdateTeamSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.errors.map((e) => e.message).join(", ") };
  }

  const { id, ...rest } = validated.data;

  try {
    const before = await prismadb.crm_Teams.findFirst({
      where: { id, deletedAt: null },
    });

    if (!before) return { error: "Team not found" };

    const team = await prismadb.crm_Teams.update({
      where: { id },
      data: {
        ...rest,
        updatedBy: session.user.id,
      },
    });

    const changes = diffObjects(
      before as Record<string, unknown>,
      team as Record<string, unknown>
    );
    await writeAuditLog({
      entityType: "team",
      entityId: team.id,
      action: "updated",
      changes,
      userId: session.user.id,
    });

    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    return { data: team };
  } catch (error) {
    console.error("[UPDATE_TEAM]", error);
    return { error: "Failed to update team" };
  }
};
