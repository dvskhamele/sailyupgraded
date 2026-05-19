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
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { handleRowClick, handleRowKeyDown } from "../../components/table-row-navigation";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import { bulkDeleteOpportunities } from "@/actions/crm/opportunities/delete-opportunity";
import { toast } from "sonner";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function OpportunitiesDataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedOpportunityIds = selectedRows.map(
    (row) => (row.original as { id: string }).id
  );
  const selectedCount = selectedOpportunityIds.length;

  const onBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const result = await bulkDeleteOpportunities(selectedOpportunityIds);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      table.toggleAllRowsSelected(false);
      toast.success(`${result.count ?? selectedCount} opportunity(s) deleted`);
      router.refresh();
    } catch {
      toast.error("Something went wrong while deleting opportunities. Please try again.");
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={onBulkDelete}
        loading={bulkDeleteLoading}
        title={`Delete ${selectedCount} opportunity(s)?`}
        description="Selected opportunities will be moved to deleted records."
      />
      <div className="flex justify-between items-start gap-3">
        <div />
        <div className="flex justify-end items-center gap-2">
          {selectedCount > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleteLoading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete selected
            </Button>
          )}
        </div>
      </div>
      <DataTableToolbar table={table} />
      <div className="rounded-md border overflow-x-auto">
        <Table data-testid="opportunities-table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={(event) =>
                    handleRowClick(event, () =>
                      router.push(`/crm/opportunities/${(row.original as { id: string }).id}`)
                    )
                  }
                  onKeyDown={(event) =>
                    handleRowKeyDown(event, () =>
                      router.push(`/crm/opportunities/${(row.original as { id: string }).id}`)
                    )
                  }
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
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
