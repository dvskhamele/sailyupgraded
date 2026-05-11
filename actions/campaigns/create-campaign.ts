"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import {
  buildCampaignStepSchedule,
  findNextAvailableSlot,
  getCampaignSlotWindow,
  getScheduleCollisions,
  isFutureSchedule,
  normalizeUtcDate,
  toUtcIsoString,
} from "@/lib/campaigns/scheduling";

type StepInput = {
  order: number;
  template_id: string;
  subject: string;
  delay_days: number;
  send_to: "all" | "non_openers";
};

export const createCampaign = async (data: {
  name: string;
  description?: string;
  from_name?: string;
  reply_to?: string;
  template_id?: string;
  target_list_ids: string[];
  steps: StepInput[];
  scheduled_at?: Date;
}) => {
  const session = await getSession();
  const { target_list_ids, steps, ...campaignData } = data;
  const scheduledAt = data.scheduled_at ? normalizeUtcDate(data.scheduled_at) : null;

  if (scheduledAt && !isFutureSchedule(scheduledAt)) {
    throw new Error("Campaign schedule must be in the future.");
  }

  if (scheduledAt) {
    const { start, end } = getCampaignSlotWindow(scheduledAt);
    const overlapping = await prismadb.crm_campaigns.findMany({
      where: {
        deletedAt: null,
        status: { in: ["scheduled", "sending"] },
        scheduled_at: { gte: start, lte: end },
      },
      select: { id: true, scheduled_at: true },
    });
    const collisions = getScheduleCollisions(scheduledAt, overlapping);

    if (collisions.length > 0) {
      const nextSlot = findNextAvailableSlot(scheduledAt, overlapping);
      throw new Error(
        `Schedule overlaps an existing campaign. Next available slot: ${toUtcIsoString(nextSlot)}`
      );
    }
  }

  const stepsToCreate: Array<StepInput & { scheduled_at: Date | null }> = scheduledAt
    ? buildCampaignStepSchedule(scheduledAt, steps)
    : steps.map((step) => ({ ...step, scheduled_at: null as Date | null }));

  return prismadb.crm_campaigns.create({
    data: {
      ...campaignData,
      scheduled_at: scheduledAt,
      v: 0,
      status: scheduledAt ? "scheduled" : "draft",
      created_by: session?.user?.id ?? null,
      target_lists: {
        create: target_list_ids.map((id) => ({ target_list_id: id })),
      },
      steps: {
        create: stepsToCreate.map((s) => ({
          order: s.order,
          subject: s.subject,
          delay_days: s.delay_days,
          send_to: s.send_to,
          template: {
            connect: { id: s.template_id },
          },
          scheduled_at: s.scheduled_at,
        })),
      },
    },
  });
};
