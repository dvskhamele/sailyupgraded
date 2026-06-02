"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const assignDocumentToTask = async (data: {
  documentId: string;
  taskId: string;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (!session.user.organizationId) return { error: "Organization context is required" };

  const { documentId, taskId } = data;
  if (!documentId) return { error: "Missing document ID" };
  if (!taskId) return { error: "Missing task ID" };

  try {
    const task = await prismadb.tasks.findFirst({
      where: { id: taskId, organizationId: session.user.organizationId },
    });

    if (!task) return { error: "Task not found" };
    const document = await prismadb.documents.findFirst({
      where: { id: documentId, organizationId: session.user.organizationId },
      select: { id: true },
    });
    if (!document) return { error: "Document not found" };

    await prismadb.documentsToTasks.create({
      data: {
        organizationId: session.user.organizationId,
        document_id: documentId,
        task_id: taskId,
      },
    });

    await prismadb.tasks.update({
      where: { id: taskId, organizationId: session.user.organizationId },
      data: { updatedBy: session.user.id },
    });

    revalidatePath("/[locale]/(routes)/projects", "page");
    return { success: true };
  } catch (error) {
    console.log("[ASSIGN_DOCUMENT_TO_TASK]", error);
    return { error: "Failed to assign document to task" };
  }
};

export const disconnectDocumentFromTask = async (data: {
  documentId: string;
  taskId: string;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (!session.user.organizationId) return { error: "Organization context is required" };

  const { documentId, taskId } = data;
  if (!documentId) return { error: "Missing document ID" };
  if (!taskId) return { error: "Missing task ID" };

  try {
    const task = await prismadb.tasks.findFirst({
      where: { id: taskId, organizationId: session.user.organizationId },
    });

    if (!task) return { error: "Task not found" };
    const document = await prismadb.documents.findFirst({
      where: { id: documentId, organizationId: session.user.organizationId },
      select: { id: true },
    });
    if (!document) return { error: "Document not found" };

    await prismadb.documentsToTasks.deleteMany({
      where: {
        document_id: documentId,
        task_id: taskId,
        organizationId: session.user.organizationId,
      },
    });

    const updatedTask = await prismadb.tasks.update({
      where: { id: taskId, organizationId: session.user.organizationId },
      data: { updatedBy: session.user.id },
    });

    revalidatePath("/[locale]/(routes)/projects", "page");
    return { data: updatedTask };
  } catch (error) {
    console.log("[DISCONNECT_DOCUMENT_FROM_TASK]", error);
    return { error: "Failed to disconnect document from task" };
  }
};
