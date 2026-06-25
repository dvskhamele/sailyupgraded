"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { RestoreTeamSchema } from "./types";
import { z } from "zod";

export const restoreTeam = async (data: z.infer<typeof RestoreTeamSchema>) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = RestoreTeamSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(", ") };
  }

  const { teamId } = validated.data;

  try {
    await prismadb.crm_Teams.update({
      where: { id: teamId },
      data: { deletedAt: null, deletedBy: null },
    });
    await writeAuditLog({
      entityType: "team",
      entityId: teamId,
      action: "restored",
      changes: null,
      userId: session.user.id,
    });
    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    revalidatePath("/[locale]/(routes)/admin/audit-log", "page");
    return { success: true };
  } catch (error) {
    console.log("[RESTORE_TEAM]", error);
    return { error: "Failed to restore team" };
  }
};
