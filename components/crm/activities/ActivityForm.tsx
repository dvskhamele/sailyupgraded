"use client";
import { useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { createActivity } from "@/actions/crm/activities/create-activity";
import { updateActivity } from "@/actions/crm/activities/update-activity";
import type { ActivityWithLinks } from "@/actions/crm/activities/get-activities-by-entity";
import { generateActivityTitle } from "@/lib/crm/activity-title";
import { searchContacts, type ContactSearchItem } from "@/actions/crm/contacts/search-contacts";
import { createContact } from "@/actions/crm/contacts/create-contact";
import useDebounce from "@/hooks/useDebounce";
import { useAutoSaveForm } from "@/hooks/use-auto-save-form";
import { cn } from "@/lib/utils";

type ActivityType = "call" | "meeting" | "note" | "email";
type ActivityStatus = "scheduled" | "completed" | "cancelled";

const DEFAULT_STATUS: Record<ActivityType, ActivityStatus> = {
  call: "scheduled",
  meeting: "scheduled",
  note: "completed",
  email: "completed",
};

function getContactName(contact: Pick<ContactSearchItem, "first_name" | "last_name" | "email">) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contact";
}

function splitContactName(value: string) {
  const cleanValue = value.trim();
  const isEmail = cleanValue.includes("@");
  const nameValue = isEmail ? cleanValue.split("@")[0].replace(/[._-]+/g, " ") : cleanValue;
  const parts = nameValue.split(/\s+/).filter(Boolean);
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "New Contact";

  return {
    firstName: parts.length > 1 ? parts[0] : "",
    lastName,
    email: isEmail ? cleanValue : "",
  };
}

function ContactActivitySelector({
  value,
  onChange,
}: {
  value: ContactSearchItem | null;
  onChange: (contact: ContactSearchItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ContactSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();
  const debouncedSearch = useDebounce(search, 300);
  const trimmedSearch = search.trim();
  const selectedName = value ? getContactName(value) : "";

  useEffect(() => {
    if (!open) return;

    const query = debouncedSearch.trim();
    if (query.length < 2) {
      setContacts([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    startTransition(async () => {
      const result = await searchContacts({ search: query, take: 8 }).catch(() => []);
      if (!active) return;
      setContacts(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [debouncedSearch, open]);

  const handleCreateContact = async () => {
    const query = trimmedSearch;
    if (!query) return;

    const parsed = splitContactName(query);
    setCreating(true);
    const result = await createContact({
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      email: parsed.email,
    });
    setCreating(false);

    if (result.error || !result.data) {
      toast.error(result.error ?? "Failed to create contact");
      return;
    }

    const createdContact = result.data as {
      id: string;
      serial?: string | null;
      first_name?: string | null;
      last_name: string;
      email?: string | null;
    };

    onChange({
      id: createdContact.id,
      serial: createdContact.serial ?? null,
      first_name: createdContact.first_name ?? null,
      last_name: createdContact.last_name,
      email: createdContact.email ?? null,
    });
    setSearch("");
    setContacts([]);
    setOpen(false);
    toast.success("Contact created");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
        >
          <span className="truncate text-sm">
            {selectedName || <span className="text-muted-foreground">Select contact</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search contacts..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList onWheelCapture={(e) => e.stopPropagation()}>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>
                  <span className="text-muted-foreground">
                    {trimmedSearch.length < 2 ? "Type at least 2 characters." : "No contacts found."}
                  </span>
                </CommandEmpty>
                <CommandGroup>
                  {contacts.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={contact.id}
                      onSelect={() => {
                        onChange(contact.id === value?.id ? null : contact);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value?.id === contact.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate">{getContactName(contact)}</p>
                        {contact.email && (
                          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {trimmedSearch.length >= 2 && contacts.length === 0 && !loading && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleCreateContact}
              disabled={creating}
            >
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : `Create "${trimmedSearch}"`}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function toDateTimeLocalValue(value = new Date()) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  links?: Array<{ entityType: string; entityId: string }>;
  activity?: ActivityWithLinks; // if provided: edit mode
  onSaved: (activity: ActivityWithLinks) => void;
}

export function ActivityForm({ open, onOpenChange, entityType, entityId, links, activity, onSaved }: Props) {
  const isEdit = !!activity;
  const hasEntityContext = !!entityType && !!entityId;
  const showContactField = !hasEntityContext && !isEdit;

  const [type, setType] = useState<ActivityType>(activity?.type ?? "call");
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [date, setDate] = useState(
    activity ? toDateTimeLocalValue(new Date(activity.date)) : toDateTimeLocalValue()
  );
  const [selectedStatus, setSelectedStatus] = useState<ActivityStatus | null>(
    activity?.status ?? null
  );
  const [duration, setDuration] = useState(activity?.duration?.toString() ?? "");
  const [outcome, setOutcome] = useState(activity?.outcome ?? "");
  const [emailSubject, setEmailSubject] = useState(
    (activity?.metadata as Record<string, string> | null)?.subject ?? ""
  );
  const [selectedContact, setSelectedContact] = useState<ContactSearchItem | null>(null);
  const [saving, setSaving] = useState(false);
  const activityDraft = {
    type,
    title,
    description,
    date,
    selectedStatus,
    duration,
    outcome,
    emailSubject,
    selectedContact,
  };
  const { clearDraft } = useAutoSaveForm({
    key: `crm-activity-${isEdit ? `update-${activity.id}` : `create-${entityType ?? "general"}-${entityId ?? "none"}`}-draft`,
    data: activityDraft,
    setData: (value) => {
      const next = typeof value === "function" ? value(activityDraft) : value;
      setType(next.type ?? "call");
      setTitle(next.title ?? "");
      setDescription(next.description ?? "");
      setDate(next.date ?? toDateTimeLocalValue());
      setSelectedStatus(next.selectedStatus ?? null);
      setDuration(next.duration ?? "");
      setOutcome(next.outcome ?? "");
      setEmailSubject(next.emailSubject ?? "");
      setSelectedContact(next.selectedContact ?? null);
    },
    enabled: open,
  });

  const showDuration = type === "call" || type === "meeting";
  const showOutcome = type === "call" || type === "meeting";
  const showEmailSubject = type === "email";
  const status =
    selectedStatus ?? (isEdit ? activity?.status ?? "scheduled" : DEFAULT_STATUS[type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const metadata: Record<string, unknown> = {};
    if (showEmailSubject && emailSubject) metadata.subject = emailSubject;

    const fallbackTitle = generateActivityTitle({
      type,
      title,
      description,
      outcome,
      note: description,
    });
    const contextLinks = entityType && entityId ? [{ entityType, entityId }] : [];
    const activityLinks =
      links ??
      (hasEntityContext
        ? contextLinks
        : selectedContact
          ? [{ entityType: "contact", entityId: selectedContact.id }]
          : activity?.links ?? []);

    if (showContactField && !selectedContact) {
      setSaving(false);
      toast.error("Select a contact for this activity");
      return;
    }

    if ((entityType || entityId || showContactField) && activityLinks.length === 0) {
      setSaving(false);
      toast.error("Activity must be linked to a CRM record");
      return;
    }

    const payload = {
      type,
      title: fallbackTitle,
      description: description.trim() || undefined,
      date: date ? new Date(date) : new Date(),
      duration: showDuration && duration ? parseInt(duration, 10) : undefined,
      outcome: showOutcome && outcome.trim() ? outcome.trim() : undefined,
      status,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      links: activityLinks,
    };

    let result: { data?: ActivityWithLinks; error?: string };

    try {
      if (isEdit) {
        result = await updateActivity({ id: activity.id, ...payload });
      } else {
        result = await createActivity(payload);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to save activity. Please try again.";
      setSaving(false);
      toast.error(message);
      return;
    }

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      clearDraft();
      toast.success(isEdit ? "Activity updated" : "Activity logged");
      onSaved(result.data as ActivityWithLinks);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Activity" : "Log Activity"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-1">
            <Label htmlFor="activity-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showContactField && (
            <div className="space-y-1">
              <Label>Contact</Label>
              <ContactActivitySelector
                value={selectedContact}
                onChange={setSelectedContact}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="activity-title">Title</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="activity-date">Date & Time</Label>
            <Input
              id="activity-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="activity-status">Status</Label>
            <Select value={status} onValueChange={(v) => setSelectedStatus(v as ActivityStatus)}>
              <SelectTrigger id="activity-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showDuration && (
            <div className="space-y-1">
              <Label htmlFor="activity-duration">Duration (minutes)</Label>
              <Input
                id="activity-duration"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          )}

          {showOutcome && (
            <div className="space-y-1">
              <Label htmlFor="activity-outcome">Outcome</Label>
              <Input
                id="activity-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Result of the call / meeting"
              />
            </div>
          )}

          {showEmailSubject && (
            <div className="space-y-1">
              <Label htmlFor="activity-email-subject">Email Subject</Label>
              <Input
                id="activity-email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject line"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="activity-description">Notes</Label>
            <Textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Log activity"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
