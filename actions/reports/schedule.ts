"use server";
import { prismadb } from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";
import type { ExportFormat } from "./types";

async function getUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createSchedule(input: { reportConfigId: string; cronExpression: string; recipients: string[]; format: ExportFormat }) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Schedule.create({ data: { organizationId, reportConfigId: input.reportConfigId, cronExpression: input.cronExpression, recipients: input.recipients, format: input.format, createdBy: userId } });
  });
}

export async function listSchedules() {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Schedule.findMany({ where: { organizationId, createdBy: userId }, include: { reportConfig: true }, orderBy: { createdAt: "desc" } });
  });
}

export async function updateSchedule(scheduleId: string, data: { cronExpression?: string; recipients?: string[]; format?: ExportFormat; isActive?: boolean }) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Schedule.update({ where: { id: scheduleId, organizationId, createdBy: userId }, data });
  });
}

export async function deleteSchedule(scheduleId: string) {
  const organizationId = await requireOrganizationId();
  const userId = await getUserId();
  return runWithOrganizationContext(organizationId, async () => {
    return prismadb.crm_Report_Schedule.delete({ where: { id: scheduleId, organizationId, createdBy: userId } });
  });
}
