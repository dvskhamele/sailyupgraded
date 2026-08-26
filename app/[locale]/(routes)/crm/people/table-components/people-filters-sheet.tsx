"use client";

import * as React from "react";
import { Filter, RotateCcw, Check, Building2, User, Globe, Mail, Phone, Linkedin, Building } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { PeopleFilterOptions } from "@/types/people";

interface PeopleFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PeopleFilterOptions;
  onApplyFilters: (filters: PeopleFilterOptions) => void;
  onResetFilters: () => void;
}

export function PeopleFiltersSheet({
  open,
  onOpenChange,
  filters,
  onApplyFilters,
  onResetFilters,
}: PeopleFiltersSheetProps) {
  const [draft, setDraft] = React.useState<PeopleFilterOptions>(filters);

  // Sync draft when filters change
  React.useEffect(() => {
    setDraft(filters);
  }, [filters, open]);

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

          {/* Country / Location Filter */}
          <div className="space-y-2">
            <Label htmlFor="filter-country" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Country / City
            </Label>
            <Input
              id="filter-country"
              placeholder="e.g. United States, India, France, Paris..."
              value={draft.country || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, country: e.target.value }))}
              className="h-9 text-sm"
            />
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
