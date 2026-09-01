"use client";

import * as React from "react";
import { X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PeopleFilterOptions } from "@/types/people";

interface PeopleActiveChipsProps {
  filters: PeopleFilterOptions;
  searchQuery: string;
  onRemoveFilter: (key: keyof PeopleFilterOptions) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

export function PeopleActiveChips({
  filters,
  searchQuery,
  onRemoveFilter,
  onClearSearch,
  onClearAll,
}: PeopleActiveChipsProps) {
  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (searchQuery.trim()) {
    activeChips.push({
      key: "search",
      label: `Search: "${searchQuery}"`,
      onRemove: onClearSearch,
    });
  }

  if (filters.type && filters.type !== "All") {
    activeChips.push({
      key: "type",
      label: `Type: ${filters.type}`,
      onRemove: () => onRemoveFilter("type"),
    });
  }

  if (filters.country && filters.country.trim()) {
    activeChips.push({
      key: "country",
      label: `Country: ${filters.country}`,
      onRemove: () => onRemoveFilter("country"),
    });
  }

  if (filters.state && filters.state.trim()) {
    activeChips.push({
      key: "state",
      label: `State: ${filters.state}`,
      onRemove: () => onRemoveFilter("state"),
    });
  }

  if (filters.city && filters.city.trim()) {
    activeChips.push({
      key: "city",
      label: `City: ${filters.city}`,
      onRemove: () => onRemoveFilter("city"),
    });
  }

  if (filters.company && filters.company.trim()) {
    activeChips.push({
      key: "company",
      label: `Company: ${filters.company}`,
      onRemove: () => onRemoveFilter("company"),
    });
  }

  if (filters.jobTitle && filters.jobTitle.trim()) {
    activeChips.push({
      key: "jobTitle",
      label: `Job Title: ${filters.jobTitle}`,
      onRemove: () => onRemoveFilter("jobTitle"),
    });
  }

  if (filters.status && filters.status !== "All") {
    activeChips.push({
      key: "status",
      label: `Status: ${filters.status}`,
      onRemove: () => onRemoveFilter("status"),
    });
  }

  if (filters.role && filters.role !== "All") {
    activeChips.push({
      key: "role",
      label: `Role: ${filters.role}`,
      onRemove: () => onRemoveFilter("role"),
    });
  }

  if (filters.hasEmail) {
    activeChips.push({
      key: "hasEmail",
      label: "Has E-mail",
      onRemove: () => onRemoveFilter("hasEmail"),
    });
  }

  if (filters.hasPhone) {
    activeChips.push({
      key: "hasPhone",
      label: "Has Phone",
      onRemove: () => onRemoveFilter("hasPhone"),
    });
  }

  if (filters.hasLinkedin) {
    activeChips.push({
      key: "hasLinkedin",
      label: "Has LinkedIn",
      onRemove: () => onRemoveFilter("hasLinkedin"),
    });
  }

  if (filters.hasCompany) {
    activeChips.push({
      key: "hasCompany",
      label: "Has Company",
      onRemove: () => onRemoveFilter("hasCompany"),
    });
  }

  if (activeChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-2">
      <span className="text-xs font-medium text-muted-foreground mr-1">Active filters:</span>
      {activeChips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="flex items-center gap-1 py-0.5 px-2.5 text-xs font-normal bg-primary/10 text-foreground border border-primary/20 hover:bg-primary/15"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove filter {chip.label}</span>
          </button>
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
      >
        <RotateCcw className="h-3 w-3" />
        Clear all
      </Button>
    </div>
  );
}
