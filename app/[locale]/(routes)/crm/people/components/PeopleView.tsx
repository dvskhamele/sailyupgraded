"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, Building2, Users, SlidersHorizontal } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createColumns } from "../table-components/columns";
import { PeopleDataTable } from "../table-components/data-table";
import { PeopleDetailSheet } from "../table-components/people-detail-sheet";
import { PeopleFiltersSheet } from "../table-components/people-filters-sheet";
import type { PeopleRecord, PeopleStats, PeopleFilterOptions, GetPeopleResponse } from "@/types/people";

interface PeopleViewProps {
  initialData: PeopleRecord[];
  initialStats?: PeopleStats;
  initialTotal?: number;
  initialPage?: number;
  initialLimit?: number;
  initialTotalPages?: number;
  defaultEmailFrom?: string;
}

const defaultFilterOptions: PeopleFilterOptions = {
  type: "All",
  country: "",
  state: "",
  city: "",
  company: "",
  jobTitle: "",
  status: "All",
  role: "All",
  hasEmail: false,
  hasPhone: false,
  hasLinkedin: false,
  hasCompany: false,
};

export default function PeopleView({
  initialData,
  initialStats = {
    totalAccounts: 0,
    totalContacts: 0,
    totalRecords: 0,
  },
  initialTotal = 0,
  initialPage = 1,
  initialLimit = 20,
  initialTotalPages = 1,
  defaultEmailFrom = "",
}: PeopleViewProps) {
  const router = useRouter();
  const [data, setData] = React.useState<PeopleRecord[]>(initialData);
  const [total, setTotal] = React.useState<number>(initialTotal || initialData.length);
  const [page, setPage] = React.useState<number>(initialPage || 1);
  const [pageSize, setPageSize] = React.useState<number>(initialLimit || 20);
  const [totalPages, setTotalPages] = React.useState<number>(
    initialTotalPages || Math.max(1, Math.ceil((initialTotal || initialData.length) / (initialLimit || 20)))
  );
  const [stats, setStats] = React.useState<PeopleStats>(initialStats);
  const [filters, setFilters] = React.useState<PeopleFilterOptions>(defaultFilterOptions);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeRecord, setActiveRecord] = React.useState<PeopleRecord | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Synchronize when initial props update from server
  const [prevInitialData, setPrevInitialData] = React.useState(initialData);
  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setData(initialData);
    setTotal(initialTotal || initialData.length);
    setPage(initialPage || 1);
    setPageSize(initialLimit || 20);
    setTotalPages(
      initialTotalPages || Math.max(1, Math.ceil((initialTotal || initialData.length) / (initialLimit || 20)))
    );
    if (initialStats) {
      setStats(initialStats);
    }
  }

  const handleViewRecord = React.useCallback((record: PeopleRecord) => {
    setActiveRecord(record);
    setDetailOpen(true);
  }, []);

  const columns = React.useMemo(
    () => createColumns({ onViewRecord: handleViewRecord }),
    [handleViewRecord]
  );

  const fetchPeopleData = async (
    targetPage = page,
    targetPageSize = pageSize,
    query = searchQuery,
    currentFilters = filters
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(targetPageSize));
      params.set("page", String(targetPage));

      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (currentFilters.type && currentFilters.type !== "All") {
        params.set("type", currentFilters.type);
      }
      if (currentFilters.country && currentFilters.country.trim()) {
        params.set("country", currentFilters.country.trim());
      }
      if (currentFilters.state && currentFilters.state.trim()) {
        params.set("state", currentFilters.state.trim());
      }
      if (currentFilters.city && currentFilters.city.trim()) {
        params.set("city", currentFilters.city.trim());
      }
      if (currentFilters.company && currentFilters.company.trim()) {
        params.set("company", currentFilters.company.trim());
      }
      if (currentFilters.jobTitle && currentFilters.jobTitle.trim()) {
        params.set("jobTitle", currentFilters.jobTitle.trim());
      }
      if (currentFilters.status && currentFilters.status !== "All") {
        params.set("status", currentFilters.status.trim());
      }
      if (currentFilters.role && currentFilters.role !== "All") {
        params.set("role", currentFilters.role.trim());
      }
      if (currentFilters.hasEmail) {
        params.set("hasEmail", "true");
      }
      if (currentFilters.hasPhone) {
        params.set("hasPhone", "true");
      }
      if (currentFilters.hasLinkedin) {
        params.set("hasLinkedin", "true");
      }
      if (currentFilters.hasCompany) {
        params.set("hasCompany", "true");
      }

      const res = await fetch(`/api/crm/people?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load filtered people data");
      const result: GetPeopleResponse = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setData(result.data);
        const resolvedTotal = typeof result.total === "number" ? result.total : result.data.length;
        const resolvedPage = typeof result.page === "number" ? result.page : targetPage;
        const resolvedLimit = typeof result.limit === "number" ? result.limit : targetPageSize;
        const resolvedTotalPages =
          typeof result.totalPages === "number"
            ? result.totalPages
            : Math.max(1, Math.ceil(resolvedTotal / resolvedLimit));

        setTotal(resolvedTotal);
        setPage(resolvedPage);
        setPageSize(resolvedLimit);
        setTotalPages(resolvedTotalPages);

        if (result.stats) {
          setStats(result.stats);
        }
      }
    } catch (error) {
      console.error("[FETCH_PEOPLE_ERROR]", error);
      toast.error("Failed to load records from database");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchPeopleData(newPage, pageSize, searchQuery, filters);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    fetchPeopleData(1, newPageSize, searchQuery, filters);
  };

  const handleApplyFilters = async (newFilters: PeopleFilterOptions) => {
    setFilters(newFilters);
    setPage(1);
    await fetchPeopleData(1, pageSize, searchQuery, newFilters);
  };

  const handleResetFilters = async () => {
    setFilters(defaultFilterOptions);
    setPage(1);
    await fetchPeopleData(1, pageSize, searchQuery, defaultFilterOptions);
  };

  const handleRefresh = async () => {
    await fetchPeopleData(page, pageSize, searchQuery, filters);
  };

  const handleServerSearch = async (query: string) => {
    setSearchQuery(query);
    setPage(1);
    await fetchPeopleData(1, pageSize, query, filters);
  };

  return (
    <div className="space-y-4">
      {/* Main Unified Data Table */}
      <PeopleDataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        stats={stats}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onServerSearch={handleServerSearch}
        onOpenFiltersSheet={() => setFilterSheetOpen(true)}
        defaultEmailFrom={defaultEmailFrom}
      />

      {/* Filter Drawer Sheet */}
      <PeopleFiltersSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        existingData={data}
      />

      {/* Detail View Sheet */}
      <PeopleDetailSheet
        record={activeRecord}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
