import {
  buildCampaignStepSchedule,
  findNextAvailableSlot,
  getScheduleCollisions,
  sortCampaignQueue,
  toUtcIsoString,
} from "@/lib/campaigns/scheduling";

describe("campaign scheduling utilities", () => {
  it("sorts the queue by scheduled time, created time, then id", () => {
    const queue = sortCampaignQueue([
      {
        id: "b",
        scheduled_at: "2026-05-12T10:00:00.000Z",
        created_on: "2026-05-11T10:00:00.000Z",
      },
      {
        id: "draft",
        scheduled_at: null,
        created_on: "2026-05-10T10:00:00.000Z",
      },
      {
        id: "a",
        scheduled_at: "2026-05-12T09:45:00.000Z",
        created_on: "2026-05-11T12:00:00.000Z",
      },
      {
        id: "c",
        scheduled_at: "2026-05-12T10:00:00.000Z",
        created_on: "2026-05-11T09:00:00.000Z",
      },
    ]);

    expect(queue.map((item) => item.id)).toEqual(["a", "c", "b", "draft"]);
  });

  it("detects overlapping queue slots", () => {
    const collisions = getScheduleCollisions("2026-05-12T10:00:00.000Z", [
      { id: "near", scheduled_at: "2026-05-12T10:10:00.000Z" },
      { id: "far", scheduled_at: "2026-05-12T10:20:00.000Z" },
      { id: "draft", scheduled_at: null },
    ]);

    expect(collisions).toEqual([
      { id: "near", scheduledAt: "2026-05-12T10:10:00.000Z" },
    ]);
  });

  it("suggests the next available slot after collisions", () => {
    const nextSlot = findNextAvailableSlot(
      "2026-05-12T10:00:00.000Z",
      [
        { id: "first", scheduled_at: "2026-05-12T10:00:00.000Z" },
        { id: "second", scheduled_at: "2026-05-12T10:15:00.000Z" },
      ],
      new Date("2026-05-12T09:00:00.000Z")
    );

    expect(toUtcIsoString(nextSlot)).toBe("2026-05-12T10:30:00.000Z");
  });

  it("builds cumulative UTC step schedules", () => {
    const schedule = buildCampaignStepSchedule("2026-05-12T10:00:00.000Z", [
      { order: 2, delay_days: 3 },
      { order: 0, delay_days: 0 },
      { order: 1, delay_days: 2 },
    ]);

    expect(schedule.map((step) => [step.order, toUtcIsoString(step.scheduled_at)])).toEqual([
      [0, "2026-05-12T10:00:00.000Z"],
      [1, "2026-05-14T10:00:00.000Z"],
      [2, "2026-05-17T10:00:00.000Z"],
    ]);
  });
});
