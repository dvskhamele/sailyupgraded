"use client";

import * as React from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import { Building2, User, Search, RefreshCw, Filter, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTableViewOptions } from "./data-table-view-options";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import type { PeopleRecord } from "@/types/people";

interface DataTableToolbarProps {
  table: Table<PeopleRecord>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  batchLimit?: number;
  onBatchLimitChange?: (limit: number) => void;
  onServerSearch?: (query: string) => void;
  activeFiltersCount?: number;
  onOpenFiltersSheet?: () => void;
}

const typeOptions = [
  {
    label: "Account",
    value: "Account",
    icon: Building2,
  },
  {
    label: "Contact",
    value: "Contact",
    icon: User,
  },
];

export function DataTableToolbar({
  table,
  globalFilter,
  onGlobalFilterChange,
  onRefresh,
  isLoading,
  batchLimit = 1000,
  onBatchLimitChange,
  onServerSearch,
  activeFiltersCount = 0,
  onOpenFiltersSheet,
}: DataTableToolbarProps) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || Boolean(globalFilter) || activeFiltersCount > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onServerSearch) {
      onServerSearch(globalFilter);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* Search Bar with live search trigger */}
        <div className="relative w-full sm:w-[260px] lg:w-[320px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search 6.25M+ records (press Enter)..."
            value={globalFilter ?? ""}
            onChange={(event) => onGlobalFilterChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 pl-8 pr-16 text-sm"
          />
          {globalFilter && onServerSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onServerSearch(globalFilter)}
              className="absolute right-1 top-1 h-6 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              Search
            </Button>
          )}
        </div>

        {/* Quick Type Filter */}
        {table.getColumn("type") && (
          <DataTableFacetedFilter
            column={table.getColumn("type")}
            title="Type"
            options={typeOptions}
          />
        )}

        {/* Advanced Filters Button with Counter */}
        {onOpenFiltersSheet && (
          <Button
            variant={activeFiltersCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={onOpenFiltersSheet}
            className="h-8 gap-1.5 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-[10px] font-bold bg-background text-foreground"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Reset Button */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              onGlobalFilterChange("");
              if (onServerSearch) onServerSearch("");
            }}
            className="h-8 px-2 lg:px-3 text-xs"
          >
            Reset
            <Cross2Icon className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {onBatchLimitChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden lg:inline">Fetch Limit:</span>
            <Select
              value={String(batchLimit)}
              onValueChange={(val) => onBatchLimitChange(Number(val))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">500 items</SelectItem>
                <SelectItem value="1000">1,000 items</SelectItem>
                <SelectItem value="2000">2,000 items</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
