"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { AssignUserSchema, BulkAssignUsersSchema, RemoveUserFromTeamSchema } from "./types";
import { z } from "zod";

export const assignUserToTeam = async (
  data: z.infer<typeof AssignUserSchema>
) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = AssignUserSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(", ") };
  }

  const { userId, teamId } = validated.data;

  try {
    // First get the user to get the old teamId
    const existingUser = await prismadb.users.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    const user = await prismadb.users.update({
      where: { id: userId },
      data: {
        teamId,
      },
    });

    await writeAuditLog({
      entityType: "user",
      entityId: user.id,
      action: "updated",
      changes: [{
        field: "teamId",
        old: existingUser?.teamId ?? null,
        new: teamId
      }],
      userId: session.user.id,
    });

    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    return { data: user };
  } catch (error) {
    console.error("[ASSIGN_USER_TO_TEAM]", error);
    return { error: "Failed to assign user" };
  }
};

export const bulkAssignUsersToTeam = async (
  data: z.infer<typeof BulkAssignUsersSchema>
) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = BulkAssignUsersSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(", ") };
  }

  const { userIds, teamId } = validated.data;

  try {
    // First get all users to get their old teamIds
    const existingUsers = await prismadb.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, teamId: true }
    });

    await prismadb.users.updateMany({
      where: { id: { in: userIds } },
      data: { teamId },
    });

    // Write audit log for bulk action
    for (const existingUser of existingUsers) {
      await writeAuditLog({
        entityType: "user",
        entityId: existingUser.id,
        action: "updated",
        changes: [{
          field: "teamId",
          old: existingUser.teamId ?? null,
          new: teamId
        }],
        userId: session.user.id,
      });
    }

    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    return { success: true };
  } catch (error) {
    console.error("[BULK_ASSIGN_USERS]", error);
    return { error: "Failed to assign users" };
  }
};

export const removeUserFromTeam = async (
  data: z.infer<typeof RemoveUserFromTeamSchema>
) => {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validated = RemoveUserFromTeamSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(", ") };
  }

  const { userId } = validated.data;

  try {
    // First get the user to get the old teamId
    const existingUser = await prismadb.users.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    const user = await prismadb.users.update({
      where: { id: userId },
      data: { teamId: null },
    });

    await writeAuditLog({
      entityType: "user",
      entityId: user.id,
      action: "updated",
      changes: [{
        field: "teamId",
        old: existingUser?.teamId ?? null,
        new: null
      }],
      userId: session.user.id,
    });

    revalidatePath("/[locale]/(routes)/crm/teams", "page");
    return { data: user };
  } catch (error) {
    console.error("[REMOVE_USER_FROM_TEAM]", error);
    return { error: "Failed to remove user" };
  }
};
