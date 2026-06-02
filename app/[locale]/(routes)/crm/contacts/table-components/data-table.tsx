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
import { Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import { bulkDeleteContacts } from "@/actions/crm/contacts/delete-contact";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleRowClick, handleRowKeyDown } from "../../components/table-row-navigation";
import { SendEmailDialog } from "../components/SendEmailDialog";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultEmailFrom?: string;
}

export function ContactsDataTable<TData, TValue>({
  columns,
  data,
  defaultEmailFrom,
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
  const [sendEmailOpen, setSendEmailOpen] = React.useState(false);
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
  const selectedContactIds = selectedRows.map(
    (row) => (row.original as { id: string }).id
  );
  const selectedContactEmails = selectedRows
    .map((row) => (row.original as { email?: string | null }).email?.trim())
    .filter((email): email is string => Boolean(email));
  const selectedCount = selectedContactIds.length;

  const onBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const result = await bulkDeleteContacts(selectedContactIds);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      table.toggleAllRowsSelected(false);
      toast.success(`${result.count ?? selectedCount} contact(s) deleted`);
      router.refresh();
    } catch {
      toast.error("Something went wrong while deleting contacts. Please try again.");
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <AlertModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={onBulkDelete}
        loading={bulkDeleteLoading}
        title={`Delete ${selectedCount} contact(s)?`}
        description="Selected contacts will be moved to deleted records."
      />
      <SendEmailDialog
        open={sendEmailOpen}
        onOpenChange={setSendEmailOpen}
        recipients={selectedContactEmails}
        defaultFrom={defaultEmailFrom}
        onSent={() => table.toggleAllRowsSelected(false)}
      />
      <div className="flex justify-between items-start gap-3">
        <div className="flex justify-end items-center gap-2">
          {selectedCount > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedContactEmails.length === 0) {
                    toast.error("Selected contact(s) do not have email addresses.");
                    return;
                  }
                  setSendEmailOpen(true);
                }}
                disabled={bulkDeleteLoading}
              >
                <Mail className="h-4 w-4 mr-1" />
                Send Email
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={bulkDeleteLoading}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete selected
              </Button>
            </>
          )}
        </div>
      </div>

      <DataTableToolbar table={table} />
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 py-2 px-1 bg-muted/50 rounded-md border">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto w-full">
        <Table data-testid="contacts-table">
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
                      router.push(`/crm/contacts/${(row.original as { id: string }).id}`)
                    )
                  }
                  onKeyDown={(event) =>
                    handleRowKeyDown(event, () =>
                      router.push(`/crm/contacts/${(row.original as { id: string }).id}`)
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
