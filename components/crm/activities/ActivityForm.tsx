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
import { UserSearchCombobox } from "@/components/ui/user-search-combobox";
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
import { createRetailAIActivity } from "@/actions/crm/retail-ai-activities/create-retail-ai-activity";
import { updateRetailAIActivity } from "@/actions/crm/retail-ai-activities/update-retail-ai-activity";
import type { RetailAIActivityAIFields } from "@/actions/crm/retail-ai-activities/types";
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
                    {trimmedSearch.length < 1 ? "Type at least 1 characters." : "No contacts found."}
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

function stringifyJsonField(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function parseJsonField(label: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: undefined };

  try {
    return { value: JSON.parse(trimmed) };
  } catch {
    return { error: `${label} must be valid JSON` };
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  links?: Array<{ entityType: string; entityId: string }>;
  activity?: ActivityWithLinks & Partial<RetailAIActivityAIFields>; // if provided: edit mode
  activityModule?: "crm" | "retail-ai";
  onSaved: (activity: ActivityWithLinks) => void;
}

export function ActivityForm({
  open,
  onOpenChange,
  entityType,
  entityId,
  links,
  activity,
  activityModule = "crm",
  onSaved,
}: Props) {
  const isEdit = !!activity;
  const hasEntityContext = !!entityType && !!entityId;
  const showContactField = !hasEntityContext && !isEdit;
  const isRetailAI = activityModule === "retail-ai";

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
  const [assignedTo, setAssignedTo] = useState(activity?.assignedTo ?? "");
  const [emailSubject, setEmailSubject] = useState(
    (activity?.metadata as Record<string, string> | null)?.subject ?? ""
  );
  const [aiSource, setAiSource] = useState(activity?.aiSource ?? "");
  const [aiInsights, setAiInsights] = useState(activity?.aiInsights ?? "");
  const [aiConfidenceScore, setAiConfidenceScore] = useState(
    activity?.aiConfidenceScore?.toString() ?? "",
  );
  const [aiMetadata, setAiMetadata] = useState(
    stringifyJsonField(activity?.aiMetadata),
  );
  const [retailAIPayload, setRetailAIPayload] = useState(
    stringifyJsonField(activity?.retailAIPayload),
  );
  const [aiStatus, setAiStatus] = useState(activity?.aiStatus ?? "");
  const [aiGeneratedSummary, setAiGeneratedSummary] = useState(
    activity?.aiGeneratedSummary ?? "",
  );
  const [transcript, setTranscript] = useState(
    stringifyJsonField(activity?.transcript),
  );
  const [recordingUrl, setRecordingUrl] = useState(activity?.recordingUrl ?? "");
  const [publicLogUrl, setPublicLogUrl] = useState(activity?.publicLogUrl ?? "");
  const [conversationId, setConversationId] = useState(activity?.conversationId ?? "");
  const [sentiment, setSentiment] = useState(activity?.sentiment ?? "");
  const [callSuccessful, setCallSuccessful] = useState<boolean | 'none'>(
    activity?.callSuccessful ?? 'none'
  );

  // New Fields
  const [call_id, setCall_id] = useState(activity?.call_id ?? "");
  const [customer_name, setCustomer_name] = useState(activity?.customer_name ?? "");
  const [phone_number, setPhone_number] = useState(activity?.phone_number ?? "");
  const [email, setEmail] = useState(activity?.email ?? "");
  const [appointment_time, setAppointment_time] = useState(
    activity?.appointment_time ? toDateTimeLocalValue(new Date(activity.appointment_time)) : ""
  );
  const [call_summary, setCall_summary] = useState(activity?.call_summary ?? "");
  const [call_successful_str, setCall_successful_str] = useState(activity?.call_successful ?? "");
  const [user_sentiment, setUser_sentiment] = useState(activity?.user_sentiment ?? "");
  const [combined_cost, setCombined_cost] = useState(activity?.combined_cost?.toString() ?? "");
  const [call_duration, setCall_duration] = useState(activity?.call_duration?.toString() ?? "");
  
  // Additional Extraction Fields
  const [state, setState] = useState(activity?.state ?? "");
  const [location, setLocation] = useState(activity?.location ?? "");
  const [timezone, setTimezone] = useState(activity?.timezone ?? "");
  const [insurance_interest, setInsurance_interest] = useState(activity?.insurance_interest ?? "");
  const [smoker_status, setSmoker_status] = useState(activity?.smoker_status ?? "");
  const [call_outcome_field, setCall_outcome_field] = useState(activity?.call_outcome ?? "");
  const [consultation_type, setConsultation_type] = useState(activity?.consultation_type ?? "");

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
    assignedTo,
    emailSubject,
    aiSource,
    aiInsights,
    aiConfidenceScore,
    aiMetadata,
    retailAIPayload,
    aiStatus,
    aiGeneratedSummary,
    transcript,
    recordingUrl,
    publicLogUrl,
    conversationId,
    sentiment,
    callSuccessful,
    call_id,
    customer_name,
    phone_number,
    email,
    appointment_time,
    call_summary,
    call_successful_str,
    user_sentiment,
    combined_cost,
    call_duration,
    state,
    location,
    timezone,
    insurance_interest,
    smoker_status,
    call_outcome: call_outcome_field,
    consultation_type,
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
      setAssignedTo(next.assignedTo ?? "");
      setEmailSubject(next.emailSubject ?? "");
      setAiSource(next.aiSource ?? "");
      setAiInsights(next.aiInsights ?? "");
      setAiConfidenceScore(next.aiConfidenceScore ?? "");
      setAiMetadata(next.aiMetadata ?? "");
      setRetailAIPayload(next.retailAIPayload ?? "");
      setAiStatus(next.aiStatus ?? "");
      setAiGeneratedSummary(next.aiGeneratedSummary ?? "");
      setTranscript(next.transcript ?? "");
      setRecordingUrl(next.recordingUrl ?? "");
      setPublicLogUrl(next.publicLogUrl ?? "");
      setConversationId(next.conversationId ?? "");
      setSentiment(next.sentiment ?? "");
      setCallSuccessful(next.callSuccessful ?? 'none');
      setCall_id(next.call_id ?? "");
      setCustomer_name(next.customer_name ?? "");
      setPhone_number(next.phone_number ?? "");
      setEmail(next.email ?? "");
      setAppointment_time(next.appointment_time ?? "");
      setCall_summary(next.call_summary ?? "");
      setCall_successful_str(next.call_successful_str ?? "");
      setUser_sentiment(next.user_sentiment ?? "");
      setCombined_cost(next.combined_cost ?? "");
      setCall_duration(next.call_duration ?? "");
      setState(next.state ?? "");
      setLocation(next.location ?? "");
      setTimezone(next.timezone ?? "");
      setInsurance_interest(next.insurance_interest ?? "");
      setSmoker_status(next.smoker_status ?? "");
      setCall_outcome_field(next.call_outcome ?? "");
      setConsultation_type(next.consultation_type ?? "");
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

    const confidence =
      aiConfidenceScore.trim() === "" ? undefined : Number(aiConfidenceScore);
    if (isRetailAI && confidence !== undefined) {
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
        setSaving(false);
        toast.error("AI confidence score must be between 0 and 100");
        return;
      }
    }

    const parsedAiMetadata = parseJsonField("AI metadata", aiMetadata);
    if (isRetailAI && parsedAiMetadata.error) {
      setSaving(false);
      toast.error(parsedAiMetadata.error);
      return;
    }

    const parsedRetailAIPayload = parseJsonField(
      "Retail AI payload",
      retailAIPayload,
    );
    if (isRetailAI && parsedRetailAIPayload.error) {
      setSaving(false);
      toast.error(parsedRetailAIPayload.error);
      return;
    }

    const parsedTranscript = parseJsonField("Transcript", transcript);
    if (isRetailAI && parsedTranscript.error) {
      setSaving(false);
      toast.error(parsedTranscript.error);
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
      assignedTo: assignedTo || null,
      links: activityLinks,
      ...(isRetailAI && {
        aiSource: aiSource.trim() || null,
        aiInsights: aiInsights.trim() || null,
        aiConfidenceScore: confidence ?? null,
        aiMetadata: parsedAiMetadata.value,
        retailAIPayload: parsedRetailAIPayload.value,
        aiStatus: aiStatus.trim() || null,
        aiGeneratedSummary: aiGeneratedSummary.trim() || null,
        transcript: parsedTranscript.value,
        recordingUrl: recordingUrl.trim() || null,
        publicLogUrl: publicLogUrl.trim() || null,
        conversationId: conversationId.trim() || null,
        sentiment: sentiment.trim() || null,
        callSuccessful: callSuccessful === 'none' ? null : callSuccessful,
        
        // New Fields
        call_id: call_id.trim() || null,
        customer_name: customer_name.trim() || null,
        phone_number: phone_number.trim() || null,
        email: email.trim() || null,
        appointment_time: appointment_time ? new Date(appointment_time) : null,
        call_summary: call_summary.trim() || null,
        call_successful: call_successful_str.trim() || null,
        user_sentiment: user_sentiment.trim() || null,
        combined_cost: combined_cost.trim() === "" ? null : Number(combined_cost),
        call_duration: call_duration.trim() === "" ? null : parseInt(call_duration, 10),
        
        // Additional Extraction Fields
        state: state.trim() || null,
        location: location.trim() || null,
        timezone: timezone.trim() || null,
        insurance_interest: insurance_interest.trim() || null,
        smoker_status: smoker_status.trim() || null,
        call_outcome: call_outcome_field.trim() || null,
        consultation_type: consultation_type.trim() || null,
      }),
    };

    let result: { data?: ActivityWithLinks; error?: string };

    try {
      if (isEdit) {
        result =
          activityModule === "retail-ai"
            ? await updateRetailAIActivity({ id: activity.id, ...payload })
            : await updateActivity({ id: activity.id, ...payload });
      } else {
        result =
          activityModule === "retail-ai"
            ? await createRetailAIActivity(payload)
            : await createActivity(payload);
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
            <Label>Assigned member</Label>
            <UserSearchCombobox
              value={assignedTo}
              onChange={setAssignedTo}
              placeholder="Select member"
              disabled={saving}
            />
          </div>

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

          {isRetailAI && (
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div>
                <h4 className="text-sm font-semibold">Retail AI</h4>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="activity-call-id">Call ID</Label>
                  <Input
                    id="activity-call-id"
                    value={call_id}
                    onChange={(e) => setCall_id(e.target.value)}
                    placeholder="e.g. call_123"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activity-customer-name">Customer Name</Label>
                  <Input
                    id="activity-customer-name"
                    value={customer_name}
                    onChange={(e) => setCustomer_name(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="activity-phone-number">Phone Number</Label>
                  <Input
                    id="activity-phone-number"
                    value={phone_number}
                    onChange={(e) => setPhone_number(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activity-email">Email</Label>
                  <Input
                    id="activity-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="activity-appointment-time">Appointment Time</Label>
                <Input
                  id="activity-appointment-time"
                  type="datetime-local"
                  value={appointment_time}
                  onChange={(e) => setAppointment_time(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="activity-call-summary">Call Summary</Label>
                <Textarea
                  id="activity-call-summary"
                  value={call_summary}
                  onChange={(e) => setCall_summary(e.target.value)}
                  placeholder="Summary of the call"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="activity-call-successful-str">Call Successful</Label>
                  <Input
                    id="activity-call-successful-str"
                    value={call_successful_str}
                    onChange={(e) => setCall_successful_str(e.target.value)}
                    placeholder="pending, reviewed, accepted"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activity-user-sentiment">User Sentiment</Label>
                  <Input
                    id="activity-user-sentiment"
                    value={user_sentiment}
                    onChange={(e) => setUser_sentiment(e.target.value)}
                    placeholder="Positive, Negative, Neutral"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="activity-combined-cost">Combined Cost</Label>
                  <Input
                    id="activity-combined-cost"
                    type="number"
                    step="0.0001"
                    value={combined_cost}
                    onChange={(e) => setCombined_cost(e.target.value)}
                    placeholder="0.0000"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activity-call-duration">Call Duration (sec)</Label>
                  <Input
                    id="activity-call-duration"
                    type="number"
                    value={call_duration}
                    onChange={(e) => setCall_duration(e.target.value)}
                    placeholder="Duration in seconds"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
                <div className="space-y-1">
                  <Label htmlFor="activity-state">State</Label>
                  <Input
                    id="activity-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. California"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activity-timezone">Timezone</Label>
                  <Input
                    id="activity-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. PST"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="activity-insurance">Insurance Interest</Label>
                  <Input
                    id="activity-insurance"
                    value={insurance_interest}
                    onChange={(e) => setInsurance_interest(e.target.value)}
                    placeholder="e.g. Whole Life"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="activity-smoker">Smoker Status</Label>
                  <Input
                    id="activity-smoker"
                    value={smoker_status}
                    onChange={(e) => setSmoker_status(e.target.value)}
                    placeholder="Smoker / Non-Smoker"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="activity-consultation">Consultation Type</Label>
                <Input
                  id="activity-consultation"
                  value={consultation_type}
                  onChange={(e) => setConsultation_type(e.target.value)}
                  placeholder="e.g. Online Consultation"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="activity-call-outcome-field">Call Outcome</Label>
                <Textarea
                  id="activity-call-outcome-field"
                  value={call_outcome_field}
                  onChange={(e) => setCall_outcome_field(e.target.value)}
                  placeholder="Detailed outcome..."
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="activity-recording-url">Recording URL</Label>
                <Input
                  id="activity-recording-url"
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="activity-transcript">Transcript JSON</Label>
                <Textarea
                  id="activity-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder='[{"role":"agent", "content":"..."}]'
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>

              <div className="pt-2 border-t">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Advanced AI Data</h5>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="activity-ai-source">AI Source</Label>
                    <Input
                      id="activity-ai-source"
                      value={aiSource}
                      onChange={(e) => setAiSource(e.target.value)}
                      placeholder="Retell AI, etc."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="activity-ai-confidence">AI Confidence Score</Label>
                    <Input
                      id="activity-ai-confidence"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={aiConfidenceScore}
                      onChange={(e) => setAiConfidenceScore(e.target.value)}
                      placeholder="0-100"
                    />
                  </div>
                </div>

                <div className="space-y-1 mt-3">
                  <Label htmlFor="activity-ai-metadata">AI Metadata JSON</Label>
                  <Textarea
                    id="activity-ai-metadata"
                    value={aiMetadata}
                    onChange={(e) => setAiMetadata(e.target.value)}
                    placeholder='{"key":"value"}'
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1 mt-3">
                  <Label htmlFor="activity-retail-ai-payload">Retail AI Payload JSON</Label>
                  <Textarea
                    id="activity-retail-ai-payload"
                    value={retailAIPayload}
                    onChange={(e) => setRetailAIPayload(e.target.value)}
                    placeholder='{"rawResponse":{}}'
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

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
