"use client";
import { useEffect, useState } from "react";
import { getCampaignScheduleAvailability } from "@/actions/campaigns/schedule-availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatLocalDateTime,
  getBrowserTimeZone,
  parseLocalDateTimeInput,
  toLocalDateTimeInputValue,
} from "@/lib/campaigns/scheduling";

type FollowUpStep = {
  order: number;
  template_id: string;
  subject: string;
  delay_days: number;
  send_to: "all" | "non_openers";
};

type Template = { id: string; name: string };

type Props = {
  initialData: {
    send_now?: boolean;
    scheduled_at?: Date;
    followUpSteps?: FollowUpStep[];
  };
  templates: Template[];
  onSubmit: (data: {
    send_now: boolean;
    scheduled_at?: Date;
    followUpSteps: FollowUpStep[];
  }) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
};

type Availability = Awaited<ReturnType<typeof getCampaignScheduleAvailability>>;

export function Step4Schedule({
  initialData,
  templates,
  onSubmit,
  onBack,
  isSubmitting,
}: Props) {
  const [sendNow, setSendNow] = useState(initialData.send_now ?? false);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (initialData.scheduled_at) {
      return toLocalDateTimeInputValue(initialData.scheduled_at);
    }
    return "";
  });
  const [followUps, setFollowUps] = useState<FollowUpStep[]>(
    initialData.followUpSteps ?? []
  );
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [isCheckingSlot, setIsCheckingSlot] = useState(false);
  const [timeZone, setTimeZone] = useState("UTC");

  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  useEffect(() => {
    if (sendNow || !scheduledAt) {
      setAvailability(null);
      setIsCheckingSlot(false);
      return;
    }

    let active = true;
    setIsCheckingSlot(true);
    const timeout = window.setTimeout(async () => {
      try {
        const result = await getCampaignScheduleAvailability(
          parseLocalDateTimeInput(scheduledAt)
        );

        if (active) {
          setAvailability(result);
          setError(result.reason === "past" ? "Choose a future time." : "");
        }
      } catch {
        if (active) {
          setAvailability(null);
        }
      } finally {
        if (active) {
          setIsCheckingSlot(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [scheduledAt, sendNow]);

  const addFollowUp = () => {
    setFollowUps((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        template_id: templates[0]?.id ?? "",
        subject: "",
        delay_days: 3,
        send_to: "all",
      },
    ]);
  };

  const removeFollowUp = (i: number) =>
    setFollowUps((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, order: idx + 1 }))
    );

  const updateFollowUp = (i: number, patch: Partial<FollowUpStep>) => {
    setFollowUps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  };

  const handleSubmit = async () => {
    if (!sendNow && !scheduledAt) {
      setError("Pick a date or choose Send Now");
      return;
    }
    try {
      const scheduledDate = sendNow ? undefined : parseLocalDateTimeInput(scheduledAt);

      if (scheduledDate) {
        const result = await getCampaignScheduleAvailability(scheduledDate);

        if (!result.available) {
          setAvailability(result);
          setError(
            result.reason === "past"
              ? "Choose a future time."
              : "This slot overlaps another scheduled campaign."
          );
          return;
        }
      }

      await onSubmit({
        send_now: sendNow,
        scheduled_at: scheduledDate,
        followUpSteps: followUps,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule campaign.");
    }
  };

  const applyNextAvailableSlot = () => {
    if (!availability?.nextAvailableAt) {
      return;
    }

    setScheduledAt(toLocalDateTimeInputValue(availability.nextAvailableAt));
    setError("");
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {/* Send timing */}
      <div className="flex flex-col gap-3">
        <Label>When to send</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={sendNow}
              onChange={() => {
                setSendNow(true);
                setError("");
              }}
            />
            <span className="text-sm">Send now</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!sendNow}
              onChange={() => {
                setSendNow(false);
                setError("");
              }}
            />
            <span className="text-sm">Schedule for later</span>
          </label>
        </div>
        {!sendNow && (
          <div className="flex flex-col gap-2">
            <Input
              type="datetime-local"
              value={scheduledAt}
              aria-describedby="schedule-timezone schedule-warning"
              aria-invalid={Boolean(error || availability?.reason === "collision")}
              onChange={(e) => {
                setScheduledAt(e.target.value);
                setError("");
              }}
            />
            <p id="schedule-timezone" className="text-xs text-muted-foreground">
              Times are shown in {timeZone}; saved and queued in UTC.
            </p>
            {isCheckingSlot && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Checking queue availability...
              </p>
            )}
            {availability?.reason === "collision" && (
              <div
                id="schedule-warning"
                role="alert"
                className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <p>
                  This slot overlaps another scheduled campaign.
                  {availability.nextAvailableAt
                    ? ` Next available: ${formatLocalDateTime(
                        availability.nextAvailableAt,
                        timeZone
                      )}.`
                    : ""}
                </p>
                {availability.nextAvailableAt && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={applyNextAvailableSlot}
                  >
                    Use next available slot
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Follow-ups */}
      <div className="flex flex-col gap-3">
        <Label>Follow-up Steps</Label>
        {followUps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No follow-ups. Add one below.
          </p>
        )}
        {followUps.map((fu, i) => (
          <div key={i} className="border rounded-md p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Follow-up {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFollowUp(i)}
              >
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Delay (days after previous)</Label>
                <Input
                  type="number"
                  min={1}
                  value={fu.delay_days}
                  onChange={(e) =>
                    updateFollowUp(i, {
                      delay_days: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Send to</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={fu.send_to}
                  onChange={(e) =>
                    updateFollowUp(i, {
                      send_to: e.target.value as "all" | "non_openers",
                    })
                  }
                >
                  <option value="all">All recipients</option>
                  <option value="non_openers">Non-openers only</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Template</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={fu.template_id}
                onChange={(e) =>
                  updateFollowUp(i, { template_id: e.target.value })
                }
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input
                value={fu.subject}
                onChange={(e) => updateFollowUp(i, { subject: e.target.value })}
                placeholder="Follow-up subject line..."
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addFollowUp}>
          + Add follow-up
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Campaign"}
        </Button>
      </div>
    </div>
  );
}
