"use server";

import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import {
  findNextAvailableSlot,
  getCampaignSlotWindow,
  getScheduleCollisions,
  isFutureSchedule,
  normalizeUtcDate,
  toUtcIsoString,
} from "@/lib/campaigns/scheduling";

export async function getCampaignScheduleAvailability(
  scheduledAt: Date | string,
  excludeCampaignId?: string
) {
  await requireOrganizationId();
  const normalizedScheduledAt = normalizeUtcDate(scheduledAt);

  if (!isFutureSchedule(normalizedScheduledAt)) {
    return {
      available: false,
      reason: "past",
      collisions: [],
      requestedAt: toUtcIsoString(normalizedScheduledAt),
      nextAvailableAt: toUtcIsoString(findNextAvailableSlot(new Date(), [])),
    };
  }

  const { start, end } = getCampaignSlotWindow(normalizedScheduledAt);
  const overlapping = await prismadb.crm_campaigns.findMany({
    where: {
      ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {}),
      deletedAt: null,
      status: { in: ["scheduled", "sending"] },
      scheduled_at: { gte: start, lte: end },
    },
    select: { id: true, scheduled_at: true },
  });
  const collisions = getScheduleCollisions(normalizedScheduledAt, overlapping);
  const nextAvailableAt =
    collisions.length > 0
      ? toUtcIsoString(findNextAvailableSlot(normalizedScheduledAt, overlapping))
      : null;

  return {
    available: collisions.length === 0,
    reason: collisions.length > 0 ? "collision" : null,
    collisions,
    requestedAt: toUtcIsoString(normalizedScheduledAt),
    nextAvailableAt,
  };
}
