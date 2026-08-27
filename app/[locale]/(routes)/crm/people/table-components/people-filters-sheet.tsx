"use client";

import * as React from "react";
import {
  Filter,
  RotateCcw,
  Check,
  Building2,
  User,
  Globe,
  Mail,
  Phone,
  Linkedin,
  Building,
  ChevronsUpDown,
  Loader2,
  X,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { PeopleFilterOptions, PeopleLocationOption, PeopleRecord } from "@/types/people";

interface PeopleFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PeopleFilterOptions;
  onApplyFilters: (filters: PeopleFilterOptions) => void;
  onResetFilters: () => void;
  existingData?: PeopleRecord[];
}

export function PeopleFiltersSheet({
  open,
  onOpenChange,
  filters,
  onApplyFilters,
  onResetFilters,
  existingData = [],
}: PeopleFiltersSheetProps) {
  const [draft, setDraft] = React.useState<PeopleFilterOptions>(filters);
  const [locations, setLocations] = React.useState<PeopleLocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = React.useState(false);
  const [locationPopoverOpen, setLocationPopoverOpen] = React.useState(false);

  // Sync draft when filters change
  React.useEffect(() => {
    setDraft(filters);
  }, [filters, open]);

  // Dynamically load unique locations from the server aggregation API
  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const fetchLocations = async () => {
      setLoadingLocations(true);
      try {
        const res = await fetch("/api/crm/people/locations", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.locations)) {
            setLocations(data.locations);
          }
        }
      } catch (err) {
        console.warn("[PEOPLE_FILTERS_SHEET] Error loading dynamic locations:", err);
      } finally {
        if (isMounted) {
          setLoadingLocations(false);
        }
      }
    };

    fetchLocations();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Merge server locations with any locations from loaded dataset, deduplicate and sort
  const allLocationOptions = React.useMemo(() => {
    const map = new Map<string, PeopleLocationOption>();

    // 1. Add server aggregated locations
    for (const loc of locations) {
      if (loc?.value && loc.value.trim().length >= 2) {
        map.set(loc.value.toLowerCase().trim(), {
          value: loc.value.trim(),
          label: loc.label || loc.value.trim(),
          type: loc.type,
        });
      }
    }

    // 2. Add from loaded records to guarantee 100% coverage
    if (Array.isArray(existingData)) {
      for (const r of existingData) {
        if (r.country && r.country.trim().length >= 2) {
          const norm = r.country.trim().toLowerCase();
          if (!map.has(norm)) {
            map.set(norm, {
              value: r.country.trim(),
              label: r.country.trim(),
              type: "country",
            });
          }
        }
        if (r.city && r.city.trim().length >= 2) {
          const norm = r.city.trim().toLowerCase();
          if (!map.has(norm)) {
            map.set(norm, {
              value: r.city.trim(),
              label: r.city.trim(),
              type: "city",
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
  }, [locations, existingData]);

  const handleApply = () => {
    onApplyFilters(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    const emptyFilters: PeopleFilterOptions = {
      type: "All",
      country: "",
      status: "All",
      role: "All",
      hasEmail: false,
      hasPhone: false,
      hasLinkedin: false,
      hasCompany: false,
    };
    setDraft(emptyFilters);
    onResetFilters();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto w-full p-6 space-y-6">
        <SheetHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <SheetTitle className="text-lg font-semibold">Filter People & Accounts</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Apply active filters to query and refine the dataset.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="space-y-5 text-sm">
          {/* Record Type Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Record Type
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={draft.type === "All" || !draft.type ? "default" : "outline"}
                size="sm"
                onClick={() => setDraft((prev) => ({ ...prev, type: "All" }))}
                className="h-8 text-xs justify-center"
              >
                All
              </Button>
              <Button
                type="button"
                variant={draft.type === "Account" ? "default" : "outline"}
                size="sm"
                onClick={() => setDraft((prev) => ({ ...prev, type: "Account" }))}
                className="h-8 text-xs justify-center gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5" />
                Account
              </Button>
              <Button
                type="button"
                variant={draft.type === "Contact" ? "default" : "outline"}
                size="sm"
                onClick={() => setDraft((prev) => ({ ...prev, type: "Contact" }))}
                className="h-8 text-xs justify-center gap-1.5"
              >
                <User className="h-3.5 w-3.5" />
                Contact
              </Button>
            </div>
          </div>

          {/* Country / City Location Searchable Dropdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="filter-country-trigger"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                Country / City
              </Label>
              {draft.country && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft((prev) => ({ ...prev, country: "" }))}
                  className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>

            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="filter-country-trigger"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationPopoverOpen}
                  className="w-full h-9 justify-between text-sm font-normal text-left bg-background"
                >
                  <span className="truncate">
                    {draft.country ? draft.country : "All Countries / Cities"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search country or city..." className="h-9 text-xs" />
                  <CommandList className="max-h-60 overflow-y-auto">
                    {loadingLocations ? (
                      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Loading locations...
                      </div>
                    ) : (
                      <>
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                          No locations available
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all countries cities"
                            onSelect={() => {
                              setDraft((prev) => ({ ...prev, country: "" }));
                              setLocationPopoverOpen(false);
                            }}
                            className="text-xs flex items-center justify-between cursor-pointer"
                          >
                            <span className="font-medium">All Countries / Cities</span>
                            {!draft.country && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </CommandItem>
                          {allLocationOptions.map((loc) => {
                            const isSelected =
                              draft.country?.toLowerCase().trim() ===
                              loc.value.toLowerCase().trim();
                            return (
                              <CommandItem
                                key={loc.value}
                                value={`${loc.label} ${loc.type || ""}`}
                                onSelect={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    country: isSelected ? "" : loc.value,
                                  }));
                                  setLocationPopoverOpen(false);
                                }}
                                className="text-xs flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="truncate">{loc.label}</span>
                                  {loc.type && (
                                    <span className="text-[10px] text-muted-foreground capitalize">
                                      ({loc.type})
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select
              value={draft.status || "All"}
              onValueChange={(val) => setDraft((prev) => ({ ...prev, status: val }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Role
            </Label>
            <Select
              value={draft.role || "All"}
              onValueChange={(val) => setDraft((prev) => ({ ...prev, role: val }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Roles</SelectItem>
                <SelectItem value="Customer">Customer</SelectItem>
                <SelectItem value="Agent">Agent</SelectItem>
                <SelectItem value="Account">Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Quality / Attribute Toggles */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Contact Attributes & Quality
            </Label>

            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
                <Checkbox
                  checked={Boolean(draft.hasEmail)}
                  onCheckedChange={(val) => setDraft((prev) => ({ ...prev, hasEmail: Boolean(val) }))}
                />
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Must have valid E-mail address</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
                <Checkbox
                  checked={Boolean(draft.hasPhone)}
                  onCheckedChange={(val) => setDraft((prev) => ({ ...prev, hasPhone: Boolean(val) }))}
                />
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Must have Phone number</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
                <Checkbox
                  checked={Boolean(draft.hasLinkedin)}
                  onCheckedChange={(val) => setDraft((prev) => ({ ...prev, hasLinkedin: Boolean(val) }))}
                />
                <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                <span>Must have LinkedIn Profile</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium">
                <Checkbox
                  checked={Boolean(draft.hasCompany)}
                  onCheckedChange={(val) => setDraft((prev) => ({ ...prev, hasCompany: Boolean(val) }))}
                />
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Must have associated Company</span>
              </label>
            </div>
          </div>
        </div>

        <SheetFooter className="flex flex-row items-center justify-between gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="text-xs gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Filters
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

