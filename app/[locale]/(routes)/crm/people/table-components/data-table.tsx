"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table";
import { Copy, Download, Users, X, Check, RotateCcw, Mail } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { PeopleDetailSheet } from "./people-detail-sheet";
import { PeopleActiveChips } from "./people-active-chips";
import { SendEmailDialog } from "@/app/[locale]/(routes)/crm/contacts/components/SendEmailDialog";
import type { PeopleRecord, PeopleFilterOptions, PeopleStats } from "@/types/people";

interface PeopleDataTableProps {
  columns: ColumnDef<PeopleRecord, any>[];
  data: PeopleRecord[];
  stats?: PeopleStats;
  filters: PeopleFilterOptions;
  onApplyFilters: (filters: PeopleFilterOptions) => void;
  onResetFilters: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  batchLimit?: number;
  onBatchLimitChange?: (limit: number) => void;
  onServerSearch?: (query: string) => void;
  onOpenFiltersSheet?: () => void;
  defaultEmailFrom?: string;
}

// Multi-field global search filter
const multiFieldFilterFn: FilterFn<PeopleRecord> = (row, columnId, filterValue: string) => {
  if (!filterValue) return true;
  const q = String(filterValue).toLowerCase().trim();
  const item = row.original;

  const searchableFields = [
    item.name,
    item.fullName,
    item.firstName,
    item.lastName,
    item.company,
    item.jobTitle,
    item.email,
    item.personalEmail,
    item.phone,
    item.mobilePhone,
    item.city,
    item.state,
    item.country,
    item.website,
    item.accountsIDs,
    item.type,
    item.role,
  ];

  return searchableFields.some(
    (field) => field && String(field).toLowerCase().includes(q)
  );
};

export function PeopleDataTable({
  columns,
  data,
  stats,
  filters,
  onApplyFilters,
  onResetFilters,
  onRefresh,
  isLoading = false,
  batchLimit,
  onBatchLimitChange,
  onServerSearch,
  onOpenFiltersSheet,
  defaultEmailFrom = "",
}: PeopleDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    city: false,
    country: false,
    createdAt: false,
    status: false,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Detail Sheet state
  const [activeRecord, setActiveRecord] = React.useState<PeopleRecord | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false);

  // Send Email Dialog state
  const [sendEmailOpen, setSendEmailOpen] = React.useState(false);

  // Calculate active filter count
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.type && filters.type !== "All") count++;
    if (filters.country && filters.country.trim()) count++;
    if (filters.status && filters.status !== "All") count++;
    if (filters.role && filters.role !== "All") count++;
    if (filters.hasEmail) count++;
    if (filters.hasPhone) count++;
    if (filters.hasLinkedin) count++;
    if (filters.hasCompany) count++;
    return count;
  }, [filters]);

  const handleRemoveSingleFilter = (key: keyof PeopleFilterOptions) => {
    const updated: PeopleFilterOptions = { ...filters };
    if (key === "type") {
      updated.type = "All";
    } else if (key === "status") {
      updated.status = "All";
    } else if (key === "role") {
      updated.role = "All";
    } else if (key === "country") {
      updated.country = "";
    } else if (key === "hasEmail") {
      updated.hasEmail = false;
    } else if (key === "hasPhone") {
      updated.hasPhone = false;
    } else if (key === "hasLinkedin") {
      updated.hasLinkedin = false;
    } else if (key === "hasCompany") {
      updated.hasCompany = false;
    }
    onApplyFilters(updated);
  };

  const handleClearSearch = () => {
    setGlobalFilter("");
    if (onServerSearch) onServerSearch("");
  };

  const handleClearAll = () => {
    setGlobalFilter("");
    if (onServerSearch) onServerSearch("");
    onResetFilters();
  };

  // Set default page size to 20
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
    globalFilterFn: multiFieldFilterFn,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const filteredRowCount = table.getFilteredRowModel().rows.length;

  // Extract valid, deduplicated emails from selected rows (Accounts and Contacts)
  const selectedEmails = React.useMemo(() => {
    const rawEmails = selectedRows
      .map((r) => r.original.email?.trim())
      .filter((e): e is string => {
        if (!e) return false;
        const normalized = e.toLowerCase();
        return (
          e.includes("@") &&
          normalized !== "unavailable" &&
          normalized !== "extrapolated" &&
          normalized !== "entry" &&
          normalized !== "null"
        );
      });
    return Array.from(new Set(rawEmails));
  }, [selectedRows]);

  const handleRowClick = (record: PeopleRecord, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest('[role="checkbox"]') ||
      target.closest('[role="menuitem"]')
    ) {
      return;
    }
    setActiveRecord(record);
    setDetailSheetOpen(true);
  };

  const handleCopySelectedEmails = () => {
    if (selectedEmails.length === 0) {
      toast.info("No valid email addresses found in selected rows.");
      return;
    }

    navigator.clipboard.writeText(selectedEmails.join(", "));
    toast.success(`Copied ${selectedEmails.length} email(s) to clipboard`);
  };

  const handleExportCSV = () => {
    const rowsToExport = selectedCount > 0
      ? selectedRows.map((r) => r.original)
      : table.getFilteredRowModel().rows.map((r) => r.original);

    if (rowsToExport.length === 0) {
      toast.info("No records to export.");
      return;
    }

    const headers = [
      "Type",
      "Name",
      "Company",
      "Title",
      "Email",
      "Phone",
      "City",
      "Country",
      "Status",
    ];

    const csvRows = [
      headers.join(","),
      ...rowsToExport.map((row) =>
        [
          `"${row.type}"`,
          `"${(row.name || "").replace(/"/g, '""')}"`,
          `"${(row.company || "").replace(/"/g, '""')}"`,
          `"${(row.jobTitle || "").replace(/"/g, '""')}"`,
          `"${(row.email || "").replace(/"/g, '""')}"`,
          `"${(row.phone || "").replace(/"/g, '""')}"`,
          `"${(row.city || "").replace(/"/g, '""')}"`,
          `"${(row.country || "").replace(/"/g, '""')}"`,
          `"${(row.status || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `people_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rowsToExport.length} record(s) to CSV`);
  };

  return (
    <div className="space-y-4">
      {/* Existing Saily Send Email Modal */}
      <SendEmailDialog
        open={sendEmailOpen}
        onOpenChange={setSendEmailOpen}
        recipients={selectedEmails}
        defaultFrom={defaultEmailFrom}
        onSent={() => {
          table.toggleAllPageRowsSelected(false);
          setRowSelection({});
          toast.success(`Email sent successfully to ${selectedEmails.length} recipient(s).`);
        }}
      />

      {/* Search & Filters Toolbar */}
      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        onRefresh={onRefresh}
        isLoading={isLoading}
        batchLimit={batchLimit}
        onBatchLimitChange={onBatchLimitChange}
        onServerSearch={onServerSearch}
        activeFiltersCount={activeFiltersCount}
        onOpenFiltersSheet={onOpenFiltersSheet}
      />

      {/* Active Filter Chips Bar */}
      <PeopleActiveChips
        filters={filters}
        searchQuery={globalFilter}
        onRemoveFilter={handleRemoveSingleFilter}
        onClearSearch={handleClearSearch}
        onClearAll={handleClearAll}
      />

      {/* Result Count and Scope Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        {/* <span>
          Showing <span className="font-semibold text-foreground">{filteredRowCount}</span> of{" "}
          <span className="font-semibold text-foreground">{data.length}</span> loaded records
          {stats?.totalRecords ? (
            <span> (searched across <span className="font-medium text-foreground">{Number(stats.totalRecords).toLocaleString()}</span> total in database)</span>
          ) : null}
        </span> */}
      </div>

      {/* Selected Action Bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-semibold">
              {selectedCount}
            </Badge>
            <span>record(s) selected</span>
            {selectedEmails.length > 0 && selectedEmails.length !== selectedCount && (
              <span className="text-xs text-muted-foreground">
                ({selectedEmails.length} with valid email)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Send Email Action Button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (selectedEmails.length === 0) {
                  toast.error("None of the selected records have valid email addresses.");
                  return;
                }
                setSendEmailOpen(true);
              }}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              Send Email {selectedEmails.length > 0 ? `(${selectedEmails.length})` : ""}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySelectedEmails}
              className="h-8 gap-1.5 text-xs bg-background"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Emails
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 gap-1.5 text-xs bg-background"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.toggleAllPageRowsSelected(false)}
              className="h-8 text-xs text-muted-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm">Applying filters and querying Accounts & Contacts...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={(e) => handleRowClick(row.original, e)}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-36 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-semibold text-foreground">No people or accounts found</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      No records matched the current combination of search and filters.
                    </p>
                    {(activeFiltersCount > 0 || globalFilter) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearAll}
                        className="mt-2 text-xs gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />

      {/* Detail View Sheet */}
      <PeopleDetailSheet
        record={activeRecord}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
