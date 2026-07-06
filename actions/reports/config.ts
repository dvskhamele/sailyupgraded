"use server";
import { prismadb } from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";
import type { Prisma } from "@prisma/client";
import type { ReportCategory } from "./types";

async function getUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function saveConfig(input: { name: string; category: ReportCategory; filters: Record<string, unknown>; isShared: boolean }) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Config.create({ data: { organizationId, name: input.name, category: input.category, filters: input.filters as Prisma.InputJsonValue, isShared: input.isShared, createdBy: userId } });
  });
}

export async function loadConfigs(category: ReportCategory) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Config.findMany({ where: { organizationId, category, OR: [{ createdBy: userId }, { isShared: true }] }, orderBy: { createdAt: "desc" } });
  });
}

export async function deleteConfig(configId: string) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Config.delete({ where: { id: configId, organizationId, createdBy: userId } });
  });
}

export async function duplicateConfig(configId: string, newName: string) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    const original = await prismadb.crm_Report_Config.findFirst({ where: { id: configId, organizationId } });
    if (!original) throw new Error("Config not found");
    return prismadb.crm_Report_Config.create({ data: { organizationId, name: newName, category: original.category, filters: original.filters as Prisma.InputJsonValue, isShared: false, createdBy: userId } });
  });
}

export async function toggleShare(configId: string, isShared: boolean) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Config.update({ where: { id: configId, organizationId, createdBy: userId }, data: { isShared } });
  });
}
