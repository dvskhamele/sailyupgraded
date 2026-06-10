import { Suspense } from "react";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { DateRangePicker } from "./DateRangePicker";
import { FilterBar } from "./FilterBar";
import { ReportToolbar } from "./ReportToolbar";
import { SavedReportsDropdown } from "./SavedReportsDropdown";
import type { ReportCategory } from "@/actions/reports/types";

import { HelpModal } from "@/components/ui/help-modal";

type ReportPageLayoutProps = {
  title: string;
  description: string;
  category: ReportCategory;
  currentFilters: string;
  helpModule?: "reports";
  filterOptions?: {
    key: string;
    labelKey: string;
    allLabelKey?: string;
    options: { value: string; label: string }[];
  }[];
  children: React.ReactNode;
};

export function ReportPageLayout({ title, description, category, currentFilters, helpModule, filterOptions, children }: ReportPageLayoutProps) {
  return (
    <Container title={title} description={description}>
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {title}
              {helpModule && <HelpModal module={helpModule} />}
            </h1>
            <Suspense><DateRangePicker /></Suspense>
            <Suspense><SavedReportsDropdown category={category} /></Suspense>
          </div>
          <Suspense><ReportToolbar category={category} currentFilters={currentFilters} /></Suspense>
        </div>
        <Suspense><FilterBar category={category} filterOptions={filterOptions} /></Suspense>
        <div className="space-y-6">{children}</div>
      </div>
    </Container>
  );
}
