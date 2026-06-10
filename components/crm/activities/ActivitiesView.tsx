"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarClock, Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserSearchCombobox } from "@/components/ui/user-search-combobox";
import { ActivityEntry } from "./ActivityEntry";
import { ActivityForm } from "./ActivityForm";
import {
  getActivities,
  getActivitiesByEntity,
} from "@/actions/crm/activities/get-activities-by-entity";
import {
  getRetailAIActivities,
  getRetailAIActivitiesByEntity,
} from "@/actions/crm/retail-ai-activities/get-retail-ai-activities";
import type {
  ActivityWithLinks,
  ActivityCursor,
  ActivityFilters,
} from "@/actions/crm/activities/get-activities-by-entity";
import {
  searchContacts,
  type ContactSearchItem,
} from "@/actions/crm/contacts/search-contacts";
import useDebounce from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

import { HelpModal } from "@/components/ui/help-modal";

interface Props {
  entityType?: string;
  entityId?: string;
  initialData: { data: ActivityWithLinks[]; nextCursor: ActivityCursor | null };
  activityModule?: "crm" | "retail-ai";
  title?: string;
  description?: string;
  createLabel?: string;
}

const TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "email", label: "Email" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const AI_STATUS_FILTERS = [
  { value: "all", label: "All AI status" },
  { value: "accepted", label: "Accepted" },
  { value: "reviewed", label: "Reviewed" },
] as const;

function getContactName(contact: ContactSearchItem) {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    contact.email ||
    "Contact"
  );
}

function ContactFilter({
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
  const [, startTransition] = useTransition();
  const debouncedSearch = useDebounce(search, 300);
  const trimmedSearch = search.trim();

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
      const result = await searchContacts({ search: query, take: 8 }).catch(
        () => [],
      );
      if (!active) return;
      setContacts(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [debouncedSearch, open]);

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
            {value ? (
              getContactName(value)
            ) : (
              <span className="text-muted-foreground">All contacts</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search contacts..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <span className="text-muted-foreground">
                    {trimmedSearch.length < 2
                      ? "Type at least 2 characters."
                      : "No contacts found."}
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
                          value?.id === contact.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate">{getContactName(contact)}</p>
                        {contact.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.email}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ActivitiesView({
  entityType,
  entityId,
  initialData,
  activityModule = "crm",
  title = "Activities",
  description = "Track meetings, calls, follow-ups, and updates.",
  createLabel = "Log Activity",
}: Props) {
  const [activities, setActivities] = useState<ActivityWithLinks[]>(
    initialData.data,
  );
  const [cursor, setCursor] = useState<ActivityCursor | null>(
    initialData.nextCursor,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<ActivityFilters["type"]>("all");
  const [statusFilter, setStatusFilter] =
    useState<ActivityFilters["status"]>("all");
  const [selectedContact, setSelectedContact] =
    useState<ContactSearchItem | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const [aiStatus, setAIStatus] = useState("all");
  const [minAIConfidence, setMinAIConfidence] = useState("");
  const [maxAIConfidence, setMaxAIConfidence] = useState("");
  const [error, setError] = useState("");
  const didMountRef = useRef(false);
  const hasEntityContext = !!entityType && !!entityId;
  const showFilters = !hasEntityContext;
  const showAIFilters = activityModule === "retail-ai";

  const filters: ActivityFilters = {
    type: typeFilter,
    status: statusFilter,
    contactId: selectedContact?.id,
    assignedTo,
    aiStatus: showAIFilters && aiStatus !== "all" ? aiStatus : undefined,
    minAIConfidence: showAIFilters && minAIConfidence ? Number(minAIConfidence) : undefined,
    maxAIConfidence: showAIFilters && maxAIConfidence ? Number(maxAIConfidence) : undefined,
  };

  const loadFirstPage = () => {
    startTransition(async () => {
      try {
        setError("");
        const result =
          activityModule === "retail-ai"
            ? hasEntityContext
              ? await getRetailAIActivitiesByEntity(entityType, entityId, undefined, filters)
              : await getRetailAIActivities(undefined, filters)
            : hasEntityContext
              ? await getActivitiesByEntity(entityType, entityId, undefined, filters)
              : await getActivities(undefined, filters);
        setActivities(result.data);
        setCursor(result.nextCursor);
      } catch {
        setError("Failed to load activities. Please try again.");
      }
    });
  };

  useEffect(() => {
    if (!showFilters) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    loadFirstPage();
  }, [
    typeFilter,
    statusFilter,
    selectedContact?.id,
    assignedTo,
    aiStatus,
    minAIConfidence,
    maxAIConfidence,
  ]);

  const loadMore = () => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      try {
        setError("");
        const result =
          activityModule === "retail-ai"
            ? hasEntityContext
              ? await getRetailAIActivitiesByEntity(entityType, entityId, cursor, filters)
              : await getRetailAIActivities(cursor, filters)
            : hasEntityContext
              ? await getActivitiesByEntity(entityType, entityId, cursor, filters)
              : await getActivities(cursor, filters);
        setActivities((prev) => [...prev, ...result.data]);
        setCursor(result.nextCursor);
      } catch {
        setError("Failed to load more activities. Please try again.");
      }
    });
  };

  const handleCreated = (activity: ActivityWithLinks) => {
    setActivities((prev) => [activity, ...prev]);
  };

  const handleUpdated = (updated: ActivityWithLinks) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
  };

  const handleDeleted = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSelectedContact(null);
    setAssignedTo("");
    setAIStatus("all");
    setMinAIConfidence("");
    setMaxAIConfidence("");
  };

  return (
    <TooltipProvider>
      <Card className="overflow-hidden rounded-3xl border bg-background/80 shadow-sm backdrop-blur">
        {/* Header */}
        <CardHeader className="flex flex-col gap-4 border-b bg-muted/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Title */}
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {title}
              <HelpModal module={activityModule === "retail-ai" ? "ai_templates" : "activities"} />
            </CardTitle>

            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Action Button */}
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="rounded-xl px-4 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            {createLabel}
          </Button>
        </CardHeader>

        {/* Content */}
        <CardContent className="space-y-5 p-6">
          {/* Filters */}
          {showFilters && (
            <div className="rounded-2xl border bg-muted/20 p-4">
              {/* Filter Header */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Filters</h4>

                  <p className="text-xs text-muted-foreground">
                    Narrow down activity results
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={clearFilters}
                  disabled={
                    typeFilter === "all" &&
                    statusFilter === "all" &&
                    !selectedContact &&
                    !assignedTo &&
                    aiStatus === "all" &&
                    !minAIConfidence &&
                    !maxAIConfidence
                  }
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>

              {/* Filter Grid */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {/* Type */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Type
                  </Label>

                  <Select
                    value={typeFilter}
                    onValueChange={(value) =>
                      setTypeFilter(value as ActivityFilters["type"])
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {TYPE_FILTERS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Status
                  </Label>

                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as ActivityFilters["status"])
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {STATUS_FILTERS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Contact
                  </Label>

                  <ContactFilter
                    value={selectedContact}
                    onChange={setSelectedContact}
                  />
                </div>

                {/* Assigned Member */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Assigned Member
                  </Label>

                  <UserSearchCombobox
                    value={assignedTo}
                    onChange={setAssignedTo}
                    placeholder="All members"
                    disabled={isPending}
                  />
                </div>

                {/* AI Status */}
                {showAIFilters && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      AI Status
                    </Label>

                    <Select value={aiStatus} onValueChange={setAIStatus}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {AI_STATUS_FILTERS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* AI Confidence */}
                {showAIFilters && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      AI Confidence Score
                    </Label>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={minAIConfidence}
                        onChange={(event) => setMinAIConfidence(event.target.value)}
                        placeholder="Min"
                        className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={maxAIConfidence}
                        onChange={(event) => setMaxAIConfidence(event.target.value)}
                        placeholder="Max"
                        className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Activities */}
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <CalendarClock className="h-6 w-6 text-muted-foreground" />
              </div>

              <h3 className="mt-4 text-sm font-semibold">
                {isPending ? "Loading activities..." : "No activities found"}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing filters or create a new activity.
              </p>
            </div>
          ) : (
            <>
              {/* Activity List */}
              <div className="space-y-4">
                {activities.map((activity) => (
                  <ActivityEntry
                    key={activity.id}
                    activity={activity}
                    entityType={entityType}
                    entityId={entityId}
                    editLinks={hasEntityContext ? undefined : activity.links}
                    activityModule={activityModule}
                    onDeleted={handleDeleted}
                    onUpdated={handleUpdated}
                  />
                ))}
              </div>

              {/* Load More */}
              {cursor && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={isPending}
                    className="rounded-xl px-5"
                  >
                    {isPending ? "Loading..." : "Load More Activities"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>

        {/* Create Modal */}
        {createOpen && (
          <ActivityForm
            open={createOpen}
            onOpenChange={setCreateOpen}
            entityType={entityType}
            entityId={entityId}
            activityModule={activityModule}
            onSaved={handleCreated}
          />
        )}
      </Card>
    </TooltipProvider>
  );
}
