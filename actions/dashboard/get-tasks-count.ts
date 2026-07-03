"use server";
import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";

export const getTasksCount = async () => {
  await requireOrganizationId();
  const data = await prismadb.tasks.count();
  return data;
};

export const getUsersTasksCount = async (userId: string) => {
  const data = await prismadb.tasks.count({
    where: {
      user: userId,
    },
  });
  return data;
};
