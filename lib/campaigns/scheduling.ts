export const CAMPAIGN_SLOT_MINUTES = 15;
export const CAMPAIGN_SLOT_MS = CAMPAIGN_SLOT_MINUTES * 60_000;
export const CAMPAIGN_NEXT_SLOT_SEARCH_LIMIT = 96;

export type CampaignQueueItem = {
  id: string;
  scheduled_at: Date | string | null;
  created_on?: Date | string | null;
};

export type CampaignStepScheduleInput = {
  order: number;
  delay_days: number;
};

export type CampaignStepSchedule<T extends CampaignStepScheduleInput> = T & {
  scheduled_at: Date;
};

export type CampaignScheduleCollision = {
  id: string;
  scheduledAt: string;
};

export function normalizeUtcDate(input: Date | string) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid schedule time.");
  }

  return date;
}

export function toUtcIsoString(input: Date | string) {
  return normalizeUtcDate(input).toISOString();
}

export function addUtcDays(input: Date | string, days: number) {
  const date = normalizeUtcDate(input);
  return new Date(date.getTime() + days * 86_400_000);
}

export function roundUpToNextSlot(input: Date | string, slotMs = CAMPAIGN_SLOT_MS) {
  const date = normalizeUtcDate(input);
  return new Date(Math.ceil(date.getTime() / slotMs) * slotMs);
}

export function isFutureSchedule(input: Date | string, now = new Date()) {
  return normalizeUtcDate(input).getTime() > now.getTime();
}

export function getCampaignSlotWindow(input: Date | string, slotMs = CAMPAIGN_SLOT_MS) {
  const scheduledAt = normalizeUtcDate(input);
  return {
    start: new Date(scheduledAt.getTime() - slotMs + 1),
    end: new Date(scheduledAt.getTime() + slotMs - 1),
  };
}

export function hasSlotCollision(
  scheduledAt: Date | string,
  existing: Array<{ id: string; scheduled_at: Date | string | null }>,
  slotMs = CAMPAIGN_SLOT_MS
) {
  const scheduledTime = normalizeUtcDate(scheduledAt).getTime();
  return existing.some((item) => {
    if (!item.scheduled_at) {
      return false;
    }

    return Math.abs(normalizeUtcDate(item.scheduled_at).getTime() - scheduledTime) < slotMs;
  });
}

export function getScheduleCollisions(
  scheduledAt: Date | string,
  existing: Array<{ id: string; scheduled_at: Date | string | null }>,
  slotMs = CAMPAIGN_SLOT_MS
): CampaignScheduleCollision[] {
  const scheduledTime = normalizeUtcDate(scheduledAt).getTime();

  return existing
    .filter((item) => {
      if (!item.scheduled_at) {
        return false;
      }

      return Math.abs(normalizeUtcDate(item.scheduled_at).getTime() - scheduledTime) < slotMs;
    })
    .map((item) => ({
      id: item.id,
      scheduledAt: toUtcIsoString(item.scheduled_at!),
    }));
}

export function findNextAvailableSlot(
  requestedAt: Date | string,
  existing: Array<{ id: string; scheduled_at: Date | string | null }>,
  now = new Date(),
  slotMs = CAMPAIGN_SLOT_MS
) {
  let candidate = roundUpToNextSlot(requestedAt, slotMs);
  const earliest = roundUpToNextSlot(new Date(now.getTime() + slotMs), slotMs);

  if (candidate.getTime() < earliest.getTime()) {
    candidate = earliest;
  }

  for (let attempt = 0; attempt < CAMPAIGN_NEXT_SLOT_SEARCH_LIMIT; attempt += 1) {
    if (!hasSlotCollision(candidate, existing, slotMs)) {
      return candidate;
    }

    candidate = new Date(candidate.getTime() + slotMs);
  }

  return candidate;
}

export function sortCampaignQueue<T extends CampaignQueueItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const aScheduled = a.scheduled_at ? normalizeUtcDate(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bScheduled = b.scheduled_at ? normalizeUtcDate(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;

    if (aScheduled !== bScheduled) {
      return aScheduled - bScheduled;
    }

    const aCreated = a.created_on ? normalizeUtcDate(a.created_on).getTime() : Number.MAX_SAFE_INTEGER;
    const bCreated = b.created_on ? normalizeUtcDate(b.created_on).getTime() : Number.MAX_SAFE_INTEGER;

    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return a.id.localeCompare(b.id);
  });
}

export function buildCampaignStepSchedule<T extends CampaignStepScheduleInput>(
  scheduledAt: Date | string,
  steps: T[]
): Array<CampaignStepSchedule<T>> {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  let cumulativeDelayDays = 0;

  return sortedSteps.map((step) => {
    const delayDays = Math.max(0, Number(step.delay_days) || 0);

    if (step.order > 0) {
      cumulativeDelayDays += delayDays;
    }

    return {
      ...step,
      delay_days: delayDays,
      scheduled_at: addUtcDays(scheduledAt, cumulativeDelayDays),
    };
  });
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalDateTimeInputValue(input: Date | string) {
  const date = normalizeUtcDate(input);

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-") + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function parseLocalDateTimeInput(value: string) {
  return normalizeUtcDate(value);
}

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatUtcDateTime(input: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(normalizeUtcDate(input));
}

export function formatLocalDateTime(input: Date | string, timeZone?: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(normalizeUtcDate(input));
}
