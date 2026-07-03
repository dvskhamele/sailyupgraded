"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const createTargetList = async (data: {
  name: string;
  description?: string;
  targetIds?: string[];
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (!session.user.organizationId) {
    return { error: "Organization context is required" };
  }

  const { name, description, targetIds = [] } = data;
  if (!name) return { error: "name is required" };

  try {
    const list = await prismadb.crm_TargetLists.create({
      data: {
        organizationId: session.user.organizationId,
        name,
        description,
        created_by: (session.user as any).id,
        targets: {
          create: targetIds.map((id: string) => ({
            organizationId: session.user.organizationId!,
            target: { connect: { id } },
          })),
        },
      },
      include: { targets: true },
    });
    revalidatePath("/[locale]/(routes)/crm/target-lists", "page");
    return { data: list };
  } catch (error) {
    return { error: "Failed to create target list" };
  }
};
