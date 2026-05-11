"use server";
import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import {
  buildCampaignStepSchedule,
  findNextAvailableSlot,
  getCampaignSlotWindow,
  getScheduleCollisions,
  isFutureSchedule,
  normalizeUtcDate,
  toUtcIsoString,
} from "@/lib/campaigns/scheduling";

export const scheduleCampaign = async (id: string, scheduledAt: Date) => {
  const normalizedScheduledAt = normalizeUtcDate(scheduledAt);

  if (!isFutureSchedule(normalizedScheduledAt)) {
    throw new Error("Campaign schedule must be in the future.");
  }

  const campaign = await prismadb.$transaction(
    async (tx) => {
      const { start, end } = getCampaignSlotWindow(normalizedScheduledAt);
      const overlapping = await tx.crm_campaigns.findMany({
        where: {
          id: { not: id },
          deletedAt: null,
          status: { in: ["scheduled", "sending"] },
          scheduled_at: { gte: start, lte: end },
        },
        select: { id: true, scheduled_at: true },
      });
      const collisions = getScheduleCollisions(normalizedScheduledAt, overlapping);

      if (collisions.length > 0) {
        const nextSlot = findNextAvailableSlot(normalizedScheduledAt, overlapping);
        throw new Error(
          `Schedule overlaps an existing campaign. Next available slot: ${toUtcIsoString(nextSlot)}`
        );
      }

      const steps = await tx.crm_campaign_steps.findMany({
        where: { campaign_id: id },
        orderBy: { order: "asc" },
        select: { id: true, order: true, delay_days: true },
      });
      const stepSchedule = buildCampaignStepSchedule(normalizedScheduledAt, steps);

      for (const step of stepSchedule) {
        await tx.crm_campaign_steps.update({
          where: { id: step.id },
          data: { delay_days: step.delay_days, scheduled_at: step.scheduled_at },
        });
      }

      return tx.crm_campaigns.update({
        where: { id },
        data: {
          status: "scheduled",
          scheduled_at: normalizedScheduledAt,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  await inngest.send({
    name: "campaigns/schedule",
    data: { campaignId: id, scheduledAt: toUtcIsoString(normalizedScheduledAt) },
  });

  return campaign;
};
