"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportCategory } from "@/actions/reports/types";
import { useTranslations } from "next-intl";

type FilterOption = {
  key: string;
  labelKey: string;
  allLabelKey?: string;
  options: { value: string; label: string }[];
};

type FilterBarProps = {
  category: ReportCategory;
  filterOptions?: FilterOption[];
};

export function FilterBar({ category, filterOptions = [] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("ReportsPage");

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  if (filterOptions.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      {/* <div className="flex gap-4 flex-wrap"> */}
        {filterOptions.map((filter) => (
          <div key={filter.key} className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">{t(filter.labelKey)}</label>
            <Select
              value={searchParams.get(filter.key) ?? "all"}
              onValueChange={(v) => updateFilter(filter.key, v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(filter.allLabelKey ?? "all")}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      {/* </div> */}
    </div>
  );
}
