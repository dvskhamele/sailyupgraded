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
import { Mail, Trash2, UserCheck } from "lucide-react";
import { createColumns } from "./columns";
import { useRouter } from "next/navigation";
import { handleRowClick, handleRowKeyDown } from "../../components/table-row-navigation";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/modals/alert-modal";
import { toast } from "sonner";
import { localLeadRepository } from "@/lib/offline-first/storage";
import { convertLeadsToContacts } from "@/actions/crm/leads/convert-leads";
import { bulkDeleteLeads } from "@/actions/crm/leads/delete-lead";
import { bulkAssignLeads } from "@/actions/crm/leads/assign-member";
import { SendEmailDialog } from "../../contacts/components/SendEmailDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConfigItem = { id: string; name: string };
type FilterOption = { label: string; value: string };
type ProductItem = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  accounts?: AccountItem[];
  contactTypes?: ConfigItem[];
  leadSources?: ConfigItem[];
  leadStatuses?: ConfigItem[];
  leadTypes?: ConfigItem[];
  products?: ProductItem[];
  productOptions?: FilterOption[];
  defaultEmailFrom?: string;
  onDataChange?: () => void | Promise<void>;
}

export function LeadDataTable<TData, TValue>({
  data,
  accounts = [],
  contactTypes = [],
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  products = [],
  productOptions = [],
  defaultEmailFrom,
  onDataChange,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const columns = createColumns(
    contactTypes,
    leadSources,
    leadStatuses,
    leadTypes,
    accounts,
    products,
    onDataChange,
  ) as ColumnDef<TData, TValue>[];
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({ products: false });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [sendEmailOpen, setSendEmailOpen] = React.useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);
  const [bulkConvertLoading, setBulkConvertLoading] = React.useState(false);
  // Bulk Assign Member states
  const [bulkAssignLoading, setBulkAssignLoading] = React.useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = React.useState(false);
  const [pendingMemberId, setPendingMemberId] = React.useState<string>("");
  const [members, setMembers] = React.useState<
    Array<{ id: string; name: string | null; email: string | null }>
  >([]);
  const [membersLoading, setMembersLoading] = React.useState(false);

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
  const selectedLeadIds = selectedRows.map(
    (row) => (row.original as { id: string }).id
  );
  const selectedLeadEmails = selectedRows
    .map((row) => (row.original as { email?: string | null }).email?.trim())
    .filter((email): email is string => Boolean(email));
  const selectedCount = selectedLeadIds.length;

  // Load members when leads are selected
  React.useEffect(() => {
    if (selectedCount === 0) return;

    const loadMembers = async () => {
      setMembersLoading(true);
      try {
        const response = await fetch("/api/crm/agents/search?take=100");
        if (!response.ok) throw new Error("Failed to load members");
        const data = await response.json();
        setMembers(data.users || []);
      } catch {
        toast.error("Failed to load members");
      } finally {
        setMembersLoading(false);
      }
    };

    loadMembers();
  }, [selectedCount]);

  const handleSelectMember = (memberId: string) => {
    if (!memberId) return;
    setPendingMemberId(memberId);
    setConfirmAssignOpen(true);
  };

  const onBulkAssign = async () => {
    if (!pendingMemberId) {
      toast.error("Please select a member");
      return;
    }
    setBulkAssignLoading(true);
    try {
      // 1. Update on server
      const result = await bulkAssignLeads(selectedLeadIds, pendingMemberId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // 2. Update local repository for offline support
      await Promise.all(
        selectedLeadIds.map(async (id) => {
          const existingLead = await localLeadRepository.getById(id);
          if (existingLead) {
            await localLeadRepository.update(id, {
              ...existingLead,
              assigned_to: pendingMemberId
            });
          }
        })
      );

      table.toggleAllRowsSelected(false);
      setPendingMemberId("");
      toast.success(`${result.count ?? selectedCount} lead(s) assigned`);
      await onDataChange?.();
      router.refresh();
    } catch {
      toast.error("Something went wrong while assigning leads. Please try again.");
    } finally {
      setBulkAssignLoading(false);
      setConfirmAssignOpen(false);
    }
  };

  const onBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      // 1. Delete from server (MariaDB)
      const result = await bulkDeleteLeads(selectedLeadIds);
      
      if ("error" in result) {
        toast.error(result.error as string);
        return;
      }

      // 2. Delete from local (IndexedDB) to update UI immediately
      await Promise.all(selectedLeadIds.map((id) => localLeadRepository.delete(id)));
      
      table.toggleAllRowsSelected(false);
      toast.success(`${selectedCount} lead(s) deleted`);
      await onDataChange?.();
      router.refresh();
    } catch (error) {
      console.error("[onBulkDelete]", error);
      toast.error("Something went wrong while deleting leads. Please try again.");
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteOpen(false);
    }
  };

  const onBulkConvert = async () => {
    console.log("[LeadDataTable] onBulkConvert called with:", JSON.stringify(selectedLeadIds));
    setBulkConvertLoading(true);
    try {
      const result = await convertLeadsToContacts(selectedLeadIds);
      console.log("[LeadDataTable] result:", JSON.stringify(result));
      if ("error" in result) {
        toast.error(result.error as string);
      } else {
        // Also remove from local repository to update UI immediately
        await Promise.all(selectedLeadIds.map((id) => localLeadRepository.delete(id)));
        table.toggleAllRowsSelected(false);
        toast.success(
          `${result.count} lead(s) converted to contacts. ${result.skipped} lead(s) skipped (already exist).`
        );
        await onDataChange?.();
      }
    } catch {
      toast.error("Something went wrong while converting leads. Please try again.");
    } finally {
      setBulkConvertLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={onBulkDelete}
        loading={bulkDeleteLoading}
        title={`Delete ${selectedCount} lead(s)?`}
        description="Selected leads will be moved to deleted records."
      />
      <AlertModal
        isOpen={confirmAssignOpen}
        onClose={() => {
          setConfirmAssignOpen(false);
          setPendingMemberId("");
        }}
        onConfirm={onBulkAssign}
        loading={bulkAssignLoading}
        title={`Assign to ${members.find((m) => m.id === pendingMemberId)?.name ?? members.find((m) => m.id === pendingMemberId)?.email}?`}
        description={`Are you sure you want to assign this member to ${selectedCount} selected lead(s)?`}
      />
      <SendEmailDialog
        open={sendEmailOpen}
        onOpenChange={setSendEmailOpen}
        recipients={selectedLeadEmails}
        defaultFrom={defaultEmailFrom}
        onSent={() => table.toggleAllRowsSelected(false)}
      />
      <div className="flex justify-between items-start gap-3">
        <div />
        <div className="flex justify-end items-center gap-2">
          {selectedCount > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (selectedLeadEmails.length === 0) {
                    toast.error("Selected lead(s) do not have email addresses.");
                    return;
                  }
                  setSendEmailOpen(true);
                }}
                disabled={bulkConvertLoading || bulkDeleteLoading || bulkAssignLoading}
              >
                <Mail className="h-4 w-4 mr-1" />
                Send Email
              </Button>
              {membersLoading ? (
                <div className="text-sm text-muted-foreground px-3 py-1.5">
                  Loading members...
                </div>
              ) : (
                <Select
                  value=""
                  onValueChange={handleSelectMember}
                  disabled={bulkConvertLoading || bulkDeleteLoading || bulkAssignLoading}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Bulk Assign Member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name ?? member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkConvert}
                disabled={bulkConvertLoading || bulkDeleteLoading || bulkAssignLoading}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Convert to Contact
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={bulkDeleteLoading || bulkConvertLoading || bulkAssignLoading}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete selected
              </Button>
            </>
          )}
        </div>
      </div>
      <DataTableToolbar table={table} productOptions={productOptions} />
      <div className="rounded-md border overflow-x-auto">
        <Table data-testid="leads-table">
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
                      router.push(`/crm/leads/${(row.original as { id: string }).id}`)
                    )
                  }
                  onKeyDown={(event) =>
                    handleRowKeyDown(event, () =>
                      router.push(`/crm/leads/${(row.original as { id: string }).id}`)
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
