"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { CreateTeamSchema } from "./types";
import { z } from "zod";

export const createTeam = async (data: z.infer<typeof CreateTeamSchema>) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = CreateTeamSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.errors.map((e) => e.message).join(", ") };
  }

  const { name, description } = validated.data;

  try {
    const team = await prismadb.crm_Teams.create({
      data: {
        name,
        description,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    });

    await writeAuditLog({
      entityType: "team",
      entityId: team.id,
      action: "created",
      userId: session.user.id,
    });

    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    return { data: team };
  } catch (error) {
    console.error("[CREATE_TEAM]", error);
    return { error: "Failed to create team" };
  }
};
