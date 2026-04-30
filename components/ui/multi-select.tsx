"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MultiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxVisibleTags?: number;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select items",
  disabled = false,
  className,
  maxVisibleTags = 2,
}: MultiSelectProps) {
  const selectedLabels = value
    .map((selectedValue) => options.find((option) => option.value === selectedValue)?.label)
    .filter((label): label is string => Boolean(label));

  const toggleValue = (selectedValue: string) => {
    if (value.includes(selectedValue)) {
      onChange(value.filter((item) => item !== selectedValue));
      return;
    }

    onChange([...value, selectedValue]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-auto min-h-10 w-full justify-between gap-2 px-3 py-2 text-left font-normal",
            !selectedLabels.length && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="flex flex-wrap gap-1">
            {selectedLabels.length > 0 ? (
              <>
                {selectedLabels.slice(0, maxVisibleTags).map((label) => (
                  <Badge key={label} variant="secondary" className="rounded-full">
                    {label}
                  </Badge>
                ))}
                {selectedLabels.length > maxVisibleTags ? (
                  <Badge variant="outline" className="rounded-full">
                    +{selectedLabels.length - maxVisibleTags} more
                  </Badge>
                ) : null}
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto">
        {options.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">No options</div>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={value.includes(option.value)}
              disabled={option.disabled}
              onCheckedChange={() => toggleValue(option.value)}
              onSelect={(event) => event.preventDefault()}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

