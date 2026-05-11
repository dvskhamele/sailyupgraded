"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, CalendarClock, CheckCircle2, MessageSquareText, PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { addContactNote } from "@/actions/crm/contacts/add-contact-note";
import { updateContactStatus } from "@/actions/crm/contacts/update-contact-status";
import { createActivity } from "@/actions/crm/activities/create-activity";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ContactTimeline } from "./ContactTimeline";
import type { CrmTimelineEvent } from "@/lib/crm/timeline-events";

function toDateTimeLocalValue(value = new Date()) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function tempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type DraftState = {
  note: string;
  call: string;
  followUp: string;
  followUpAt: string;
  reminder: string;
  reminderAt: string;
  status: "active" | "inactive";
  statusNote: string;
};

const initialDraft = (status: boolean): DraftState => ({
  note: "",
  call: "",
  followUp: "",
  followUpAt: toDateTimeLocalValue(),
  reminder: "",
  reminderAt: toDateTimeLocalValue(),
  status: status ? "active" : "inactive",
  statusNote: "",
});

export function ContactActivitySidebar({
  contactId,
  initialContactStatus,
  initialEvents,
}: {
  contactId: string;
  initialContactStatus: boolean;
  initialEvents: CrmTimelineEvent[];
}) {
  const storageKey = `crm-contact-quick-actions:${contactId}`;
  const [events, setEvents] = useState(initialEvents);
  const [draft, setDraft] = useState<DraftState>(() => initialDraft(initialContactStatus));
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      setDraft({ ...initialDraft(initialContactStatus), ...JSON.parse(saved) });
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [initialContactStatus, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey]);

  const latestEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [events]
  );

  const pushOptimisticEvent = (event: CrmTimelineEvent) => {
    setEvents((current) => [event, ...current]);
    return event.id;
  };

  const removeEvent = (eventId: string) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
  };

  const replaceEvent = (eventId: string, event: CrmTimelineEvent) => {
    setEvents((current) => current.map((item) => (item.id === eventId ? event : item)));
  };

  const saveNote = () => {
    const text = draft.note.trim();
    if (!text) return;
    const optimisticId = pushOptimisticEvent({
      id: tempId(),
      type: "note",
      title: "Note",
      description: text,
      contactId,
      createdAt: new Date().toISOString(),
      metadata: { optimistic: true },
    });

    startTransition(async () => {
      const result = await addContactNote(contactId, text);
      if (result.error || !result.data) {
        removeEvent(optimisticId);
        toast.error(result.error ?? "Failed to save note");
        return;
      }

      replaceEvent(optimisticId, {
        id: result.data.id,
        type: "note",
        title: "Note",
        description: result.data.text,
        contactId,
        createdAt: result.data.createdAt,
        metadata: { source: "contact.notes" },
      });
      setDraft((current) => ({ ...current, note: "" }));
      toast.success("Note saved");
    });
  };

  const saveActivity = ({
    type,
    description,
    date,
    status,
    title,
    metadata,
    clear,
  }: {
    type: "call" | "meeting" | "note" | "email";
    description: string;
    date: Date;
    status: "scheduled" | "completed" | "cancelled";
    title: string;
    metadata: Record<string, unknown>;
    clear: (current: DraftState) => DraftState;
  }) => {
    const text = description.trim();
    if (!text) return;
    const optimisticId = pushOptimisticEvent({
      id: tempId(),
      type: "activity",
      title,
      description: text,
      contactId,
      createdAt: date.toISOString(),
      metadata: { ...metadata, status, optimistic: true },
    });

    startTransition(async () => {
      const result = await createActivity({
        type,
        title,
        description: text,
        date,
        status,
        metadata,
        links: [{ entityType: "contact", entityId: contactId }],
      });
      if (result.error || !result.data) {
        removeEvent(optimisticId);
        toast.error(result.error ?? "Failed to save activity");
        return;
      }

      replaceEvent(optimisticId, {
        id: result.data.id,
        type: "activity",
        title: result.data.title,
        description: result.data.description,
        contactId,
        createdAt: new Date(result.data.date).toISOString(),
        metadata: {
          activityType: result.data.type,
          status: result.data.status,
          outcome: result.data.outcome,
        },
      });
      setDraft(clear);
      toast.success("Activity saved");
    });
  };

  const saveStatus = () => {
    const nextStatus = draft.status === "active";
    const description = draft.statusNote.trim() || `Status changed to ${nextStatus ? "Active" : "Inactive"}`;
    const optimisticId = pushOptimisticEvent({
      id: tempId(),
      type: "activity",
      title: "Status update",
      description,
      contactId,
      createdAt: new Date().toISOString(),
      metadata: { status: nextStatus, optimistic: true },
    });

    startTransition(async () => {
      const result = await updateContactStatus(contactId, nextStatus);
      if (result.error || !result.data) {
        removeEvent(optimisticId);
        toast.error(result.error ?? "Failed to update status");
        return;
      }
      replaceEvent(optimisticId, {
        id: `status-${result.data.id}-${new Date(result.data.updatedAt ?? Date.now()).getTime()}`,
        type: "activity",
        title: "Status update",
        description,
        contactId,
        createdAt: new Date(result.data.updatedAt ?? Date.now()).toISOString(),
        metadata: { status: result.data.status },
      });
      setDraft((current) => ({ ...current, statusNote: "" }));
      toast.success("Status updated");
    });
  };

  return (
    <aside className="space-y-4 xl:sticky xl:top-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? "Open" : "Collapse"}
          </Button>
        </CardHeader>
        {!collapsed && (
          <CardContent>
            <Tabs defaultValue="note">
              <TabsList className="grid h-auto w-full grid-cols-5">
                <TabsTrigger value="note" aria-label="Quick note">
                  <MessageSquareText className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="call" aria-label="Quick call log">
                  <PhoneCall className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="follow-up" aria-label="Follow-up scheduling">
                  <CalendarClock className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="reminder" aria-label="Reminder">
                  <Bell className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="status" aria-label="Status update">
                  <CheckCircle2 className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="note" className="space-y-3">
                <Label htmlFor="quick-note">Quick Note</Label>
                <Textarea
                  id="quick-note"
                  value={draft.note}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Add a note..."
                  rows={4}
                />
                <Button type="button" className="w-full" onClick={saveNote} disabled={isPending || !draft.note.trim()}>
                  Save note
                </Button>
              </TabsContent>

              <TabsContent value="call" className="space-y-3">
                <Label htmlFor="quick-call">Call Log</Label>
                <Textarea
                  id="quick-call"
                  value={draft.call}
                  onChange={(event) => setDraft((current) => ({ ...current, call: event.target.value }))}
                  placeholder="What happened on the call?"
                  rows={4}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={isPending || !draft.call.trim()}
                  onClick={() =>
                    saveActivity({
                      type: "call",
                      title: "Call log",
                      description: draft.call,
                      date: new Date(),
                      status: "completed",
                      metadata: { quickAction: "call_log" },
                      clear: (current) => ({ ...current, call: "" }),
                    })
                  }
                >
                  Log call
                </Button>
              </TabsContent>

              <TabsContent value="follow-up" className="space-y-3">
                <Label htmlFor="quick-follow-up">Follow-up</Label>
                <Textarea
                  id="quick-follow-up"
                  value={draft.followUp}
                  onChange={(event) => setDraft((current) => ({ ...current, followUp: event.target.value }))}
                  placeholder="Follow-up details..."
                  rows={3}
                />
                <Input
                  type="datetime-local"
                  value={draft.followUpAt}
                  onChange={(event) => setDraft((current) => ({ ...current, followUpAt: event.target.value }))}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={isPending || !draft.followUp.trim()}
                  onClick={() =>
                    saveActivity({
                      type: "call",
                      title: "Follow-up",
                      description: draft.followUp,
                      date: draft.followUpAt ? new Date(draft.followUpAt) : new Date(),
                      status: "scheduled",
                      metadata: { quickAction: "follow_up" },
                      clear: (current) => ({ ...current, followUp: "", followUpAt: toDateTimeLocalValue() }),
                    })
                  }
                >
                  Schedule follow-up
                </Button>
              </TabsContent>

              <TabsContent value="reminder" className="space-y-3">
                <Label htmlFor="quick-reminder">Reminder</Label>
                <Textarea
                  id="quick-reminder"
                  value={draft.reminder}
                  onChange={(event) => setDraft((current) => ({ ...current, reminder: event.target.value }))}
                  placeholder="Reminder details..."
                  rows={3}
                />
                <Input
                  type="datetime-local"
                  value={draft.reminderAt}
                  onChange={(event) => setDraft((current) => ({ ...current, reminderAt: event.target.value }))}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={isPending || !draft.reminder.trim()}
                  onClick={() =>
                    saveActivity({
                      type: "note",
                      title: "Reminder",
                      description: draft.reminder,
                      date: draft.reminderAt ? new Date(draft.reminderAt) : new Date(),
                      status: "scheduled",
                      metadata: { quickAction: "reminder" },
                      clear: (current) => ({ ...current, reminder: "", reminderAt: toDateTimeLocalValue() }),
                    })
                  }
                >
                  Create reminder
                </Button>
              </TabsContent>

              <TabsContent value="status" className="space-y-3">
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, status: value as "active" | "inactive" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={draft.statusNote}
                  onChange={(event) => setDraft((current) => ({ ...current, statusNote: event.target.value }))}
                  placeholder="Optional status note"
                  rows={3}
                />
                <Button type="button" className="w-full" onClick={saveStatus} disabled={isPending}>
                  Update status
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>

      <ContactTimeline events={latestEvents} />
    </aside>
  );
}
