"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const deleteTask = async (data: { id: string; section?: string }) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (!session.user.organizationId) return { error: "Organization context is required" };

  const { id } = data;
  if (!id) return { error: "Missing task ID" };

  try {
    const currentTask = await prismadb.tasks.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    // Delete all task comments first (foreign key constraint)
    await prismadb.tasksComments.deleteMany({
      where: { task: id, organizationId: session.user.organizationId },
    });

    await prismadb.tasks.delete({
      where: { id, organizationId: session.user.organizationId },
    });

    if (currentTask) {
      // Reorder remaining tasks in the section
      const tasks = await prismadb.tasks.findMany({
        where: { section: currentTask.section, organizationId: session.user.organizationId },
        orderBy: { position: "asc" },
      });

      for (const key in tasks) {
        const position = parseInt(key);
        await prismadb.tasks.update({
          where: { id: tasks[key].id, organizationId: session.user.organizationId },
          data: {
            updatedBy: session.user.id,
            position,
          },
        });
      }
    }

    revalidatePath("/[locale]/(routes)/projects", "page");
    return { success: true };
  } catch (error) {
    console.log("[DELETE_TASK]", error);
    return { error: "Failed to delete task" };
  }
};
