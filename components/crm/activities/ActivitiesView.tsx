"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
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
import { getActivities, getActivitiesByEntity } from "@/actions/crm/activities/get-activities-by-entity";
import type {
  ActivityWithLinks,
  ActivityCursor,
  ActivityFilters,
} from "@/actions/crm/activities/get-activities-by-entity";
import { searchContacts, type ContactSearchItem } from "@/actions/crm/contacts/search-contacts";
import useDebounce from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface Props {
  entityType?: string;
  entityId?: string;
  initialData: { data: ActivityWithLinks[]; nextCursor: ActivityCursor | null };
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

function getContactName(contact: ContactSearchItem) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contact";
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
      const result = await searchContacts({ search: query, take: 8 }).catch(() => []);
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
            {value ? getContactName(value) : <span className="text-muted-foreground">All contacts</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search contacts..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
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
      </PopoverContent>
    </Popover>
  );
}

export function ActivitiesView({ entityType, entityId, initialData }: Props) {
  const [activities, setActivities] = useState<ActivityWithLinks[]>(initialData.data);
  const [cursor, setCursor] = useState<ActivityCursor | null>(initialData.nextCursor);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<ActivityFilters["type"]>("all");
  const [statusFilter, setStatusFilter] = useState<ActivityFilters["status"]>("all");
  const [selectedContact, setSelectedContact] = useState<ContactSearchItem | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const didMountRef = useRef(false);
  const hasEntityContext = !!entityType && !!entityId;
  const showFilters = !hasEntityContext;

  const filters: ActivityFilters = {
    type: typeFilter,
    status: statusFilter,
    contactId: selectedContact?.id,
    assignedTo,
  };

  const loadFirstPage = () => {
    startTransition(async () => {
      const result = hasEntityContext
        ? await getActivitiesByEntity(entityType, entityId, undefined, filters)
        : await getActivities(undefined, filters);
      setActivities(result.data);
      setCursor(result.nextCursor);
    });
  };

  useEffect(() => {
    if (!showFilters) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    loadFirstPage();
  }, [typeFilter, statusFilter, selectedContact?.id, assignedTo]);

  const loadMore = () => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const result = hasEntityContext
        ? await getActivitiesByEntity(entityType, entityId, cursor, filters)
        : await getActivities(cursor, filters);
      setActivities((prev) => [...prev, ...result.data]);
      setCursor(result.nextCursor);
    });
  };

  const handleCreated = (activity: ActivityWithLinks) => {
    setActivities((prev) => [activity, ...prev]);
  };

  const handleUpdated = (updated: ActivityWithLinks) => {
    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDeleted = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSelectedContact(null);
    setAssignedTo("");
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Activities</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Log activity
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {showFilters && (
            <div className="grid gap-3 border-b pb-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ActivityFilters["type"])}>
                  <SelectTrigger>
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
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as ActivityFilters["status"])}
                >
                  <SelectTrigger>
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
              <div className="space-y-1">
                <Label>Contact</Label>
                <ContactFilter value={selectedContact} onChange={setSelectedContact} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>Assigned member</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={clearFilters}
                    disabled={
                      typeFilter === "all" &&
                      statusFilter === "all" &&
                      !selectedContact &&
                      !assignedTo
                    }
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                </div>
                <UserSearchCombobox
                  value={assignedTo}
                  onChange={setAssignedTo}
                  placeholder="All members"
                  disabled={isPending}
                />
              </div>
            </div>
          )}
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {isPending ? "Loading activities..." : "No activities found."}
            </p>
          ) : (
            <>
              {activities.map((activity) => (
                <ActivityEntry
                  key={activity.id}
                  activity={activity}
                  entityType={entityType}
                  entityId={entityId}
                  editLinks={hasEntityContext ? undefined : activity.links}
                  onDeleted={handleDeleted}
                  onUpdated={handleUpdated}
                />
              ))}
              {cursor && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMore}
                    disabled={isPending}
                  >
                    {isPending ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>

        {createOpen && (
          <ActivityForm
            open={createOpen}
            onOpenChange={setCreateOpen}
            entityType={entityType}
            entityId={entityId}
            onSaved={handleCreated}
          />
        )}
      </Card>
    </TooltipProvider>
  );
}
