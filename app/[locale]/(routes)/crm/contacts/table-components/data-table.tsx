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
import { Bot, Loader2, Mail, MessageSquare, PhoneCall, Sparkles, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AlertModal from "@/components/modals/alert-modal";
import { bulkDeleteContacts } from "@/actions/crm/contacts/delete-contact";
import { bulkAssignContacts } from "@/actions/crm/contacts/assign-member";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleRowClick, handleRowKeyDown } from "../../components/table-row-navigation";
import { SendEmailDialog } from "../components/SendEmailDialog";
import { SendWhatsAppDialog } from "../components/SendWhatsAppDialog";
import { AICallDialog } from "../components/AICallDialog";
import { SendMessageDialog } from "@/app/[locale]/(routes)/crm/people/table-components/send-message-dialog";
import type { BulkMessageRecipient } from "@/actions/crm/messages/send-bulk-messages";
import { cleanWhatsAppPhoneNumber } from "@/lib/whatsapp-extension";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultEmailFrom?: string;
  assignedMemberFilter?: React.ReactNode;
}

export function ContactsDataTable<TData, TValue>({
  columns,
  data,
  defaultEmailFrom,
  assignedMemberFilter,
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
  const [sendWhatsAppOpen, setSendWhatsAppOpen] = React.useState(false);
  const [aiCallOpen, setAiCallOpen] = React.useState(false);
  const [sendMessageOpen, setSendMessageOpen] = React.useState(false);
  const [messageDefaultChannel, setMessageDefaultChannel] =
    React.useState<"sms" | "email" | "whatsapp">("sms");
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);
  const [bulkEnrichLoading, setBulkEnrichLoading] = React.useState(false);

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
  const selectedContacts = React.useMemo(
    () => selectedRows.map((row) => row.original as any),
    [selectedRows]
  );
  const selectedContactIds = React.useMemo(
    () => selectedContacts.map((c) => c.id as string),
    [selectedContacts]
  );
  const selectedCount = selectedContactIds.length;

  const selectedContactRecipients = React.useMemo<BulkMessageRecipient[]>(() => {
    return selectedContacts.map((c) => {
      const firstName = c.first_name || (c.name ? c.name.split(" ")[0] : "");
      const lastName =
        c.last_name ||
        (c.name && c.name.split(" ").length > 1
          ? c.name.split(" ").slice(1).join(" ")
          : "");
      const fullName =
        [firstName, lastName].filter(Boolean).join(" ") || c.name || "Contact";
      const company = c.company || c.assigned_accounts?.name || "";
      const jobTitle = c.jobTitle || c.position || c.role || "";
      const phone = c.mobile_phone || c.phone || c.office_phone || null;
      const email = c.email || c.personal_email || null;

      return {
        id: c.id,
        originalId: c.id,
        name: fullName,
        fullName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        personalEmail: c.personal_email || undefined,
        phone: phone || undefined,
        mobilePhone: c.mobile_phone || undefined,
        officePhone: c.office_phone || undefined,
        company: company || undefined,
        jobTitle: jobTitle || undefined,
        type: "Contact",
      };
    });
  }, [selectedContacts]);

  const selectedContactEmails = React.useMemo(() => {
    const rawEmails = selectedContacts
      .map((c) => {
        return (c.email || c.personal_email)?.trim();
      })
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
  }, [selectedContacts]);

  const selectedContactsWithPhone = React.useMemo(() => {
    return selectedContacts.filter((c) => {
      const rawPhone = c.mobile_phone || c.phone || c.office_phone;
      return Boolean(cleanWhatsAppPhoneNumber(rawPhone));
    });
  }, [selectedContacts]);

  // Load members when contacts are selected
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
      const result = await bulkAssignContacts(selectedContactIds, pendingMemberId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      table.toggleAllRowsSelected(false);
      setPendingMemberId("");
      toast.success(`${result.count ?? selectedCount} contact(s) assigned`);
      router.refresh();
    } catch {
      toast.error("Something went wrong while assigning contacts. Please try again.");
    } finally {
      setBulkAssignLoading(false);
      setConfirmAssignOpen(false);
    }
  };

  const onBulkEnrich = async () => {
    if (selectedContactIds.length === 0 || bulkEnrichLoading) return;
    setBulkEnrichLoading(true);
    try {
      const response = await fetch("/api/contacts/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIds: selectedContactIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Something went wrong while enriching contacts.");
        return;
      }

      const successCount = data.successCount ?? 0;
      const failedCount = data.failedCount ?? 0;

      if (failedCount > 0 && successCount > 0) {
        toast.info(`${successCount} contact(s) enriched successfully, ${failedCount} failed.`);
      } else if (successCount > 0) {
        toast.success(`${successCount} contact(s) enriched successfully.`);
      } else if (failedCount > 0) {
        toast.error(data.failedContacts?.[0]?.error || "Failed to enrich selected contacts.");
      } else {
        toast.info("No contacts needed enrichment.");
      }

      table.toggleAllRowsSelected(false);
      setRowSelection({});
      router.refresh();
    } catch (error) {
      console.error("Bulk contact enrichment error:", error);
      toast.error("Failed to connect to enrichment service. Please try again.");
    } finally {
      setBulkEnrichLoading(false);
    }
  };

  const handleSendEmail = () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one contact.");
      return;
    }
    if (selectedContactEmails.length === 0) {
      toast.error("None of the selected contacts have a valid email address.");
      return;
    }
    const skipped = selectedCount - selectedContactEmails.length;
    if (skipped > 0) {
      toast.info(
        `${skipped} contact(s) missing a valid email address will be skipped.`
      );
    }
    setSendEmailOpen(true);
  };

  const handleSendMessage = () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one contact.");
      return;
    }
    if (selectedContactsWithPhone.length === 0) {
      toast.error("None of the selected contacts have a valid phone number.");
      return;
    }
    const skipped = selectedCount - selectedContactsWithPhone.length;
    if (skipped > 0) {
      toast.info(
        `${skipped} contact(s) missing a valid phone number will be skipped.`
      );
    }
    setMessageDefaultChannel("sms");
    setSendMessageOpen(true);
  };

  const handleWhatsApp = () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one contact.");
      return;
    }
    if (selectedContactsWithPhone.length === 0) {
      toast.error("No selected contacts have a valid phone number.");
      return;
    }
    const skipped = selectedCount - selectedContactsWithPhone.length;
    if (skipped > 0) {
      toast.info(
        `${selectedContactsWithPhone.length} recipient(s) will receive the WhatsApp message. ${skipped} selected contact(s) have no valid phone number and will be skipped.`
      );
    }
    setSendWhatsAppOpen(true);
  };

  const handleAICall = () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one contact.");
      return;
    }
    if (selectedContactsWithPhone.length === 0) {
      toast.error("No selected contacts have a valid phone number.");
      return;
    }
    const skipped = selectedCount - selectedContactsWithPhone.length;
    if (skipped > 0) {
      toast.info(
        `${selectedContactsWithPhone.length} contact(s) are ready for AI calling. ${skipped} selected contact(s) have no valid phone number and will be skipped.`
      );
    }
    setAiCallOpen(true);
  };

  const handleClearSelection = () => {
    table.toggleAllRowsSelected(false);
    setRowSelection({});
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
      <AlertModal
        isOpen={confirmAssignOpen}
        onClose={() => {
          setConfirmAssignOpen(false);
          setPendingMemberId("");
        }}
        onConfirm={onBulkAssign}
        loading={bulkAssignLoading}
        title={`Assign to ${members.find((m) => m.id === pendingMemberId)?.name ?? members.find((m) => m.id === pendingMemberId)?.email}?`}
        description={`Are you sure you want to assign this member to ${selectedCount} selected contact${selectedCount > 1 ? "s" : ""}?`}
      />
      <SendEmailDialog
        open={sendEmailOpen}
        onOpenChange={setSendEmailOpen}
        recipients={selectedContactEmails}
        defaultFrom={defaultEmailFrom}
        onSent={() => {
          table.toggleAllRowsSelected(false);
          setRowSelection({});
        }}
      />
      <SendWhatsAppDialog
        open={sendWhatsAppOpen}
        onOpenChange={setSendWhatsAppOpen}
        contacts={selectedContacts}
        onSent={() => {
          table.toggleAllRowsSelected(false);
          setRowSelection({});
        }}
      />
      <AICallDialog
        open={aiCallOpen}
        onOpenChange={setAiCallOpen}
        contacts={selectedContacts}
        entityType="contact"
        onCallsStarted={() => {
          table.toggleAllRowsSelected(false);
          setRowSelection({});
        }}
      />
      <SendMessageDialog
        open={sendMessageOpen}
        onOpenChange={setSendMessageOpen}
        recipients={selectedContactRecipients}
        defaultChannel={messageDefaultChannel}
        defaultFromEmail={defaultEmailFrom}
        onSent={() => {
          table.toggleAllRowsSelected(false);
          setRowSelection({});
        }}
      />
      <div className="flex justify-between items-start gap-3">
        <div />
        <div className="flex justify-end items-center gap-2 flex-wrap">
          {selectedCount > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendEmail}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              >
                <Mail className="h-4 w-4 mr-1" />
                Send Email
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleWhatsApp}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
                className="border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 text-foreground"
              >
                <MessageSquare className="h-4 w-4 mr-1 text-emerald-600 dark:text-emerald-500" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAICall}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
                className="border-primary/30 hover:bg-primary/5 hover:text-primary text-foreground"
                data-testid="bulk-ai-call-btn"
              >
                <Bot className="h-4 w-4 mr-1 text-primary" />
                AI Call
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearSelection}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Selection
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendMessage}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Send Message
              </Button>
              {membersLoading ? (
                <div className="text-sm text-muted-foreground px-3 py-1.5">
                  Loading members...
                </div>
              ) : (
                <Select
                  value=""
                  onValueChange={handleSelectMember}
                  disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
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
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkEnrich}
                disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
                data-testid="bulk-enrich-btn"
              >
                {bulkEnrichLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Enrich
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <DataTableToolbar
        table={table}
        assignedMemberFilter={assignedMemberFilter}
      />
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-semibold">
              {selectedCount}
            </Badge>
            <span>{selectedCount === 1 ? "contact" : "contacts"} selected</span>
            {selectedContactEmails.length > 0 && selectedContactEmails.length !== selectedCount && (
              <span className="text-xs text-muted-foreground">
                ({selectedContactEmails.length} with valid email)
              </span>
            )}
            {selectedContactsWithPhone.length > 0 && selectedContactsWithPhone.length !== selectedCount && (
              <span className="text-xs text-muted-foreground">
                ({selectedContactsWithPhone.length} with valid phone)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendEmail}
              disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              className="h-8 gap-1.5 text-xs bg-background shadow-xs font-medium"
            >
              <Mail className="h-3.5 w-3.5" />
              Send Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleWhatsApp}
              disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              className="h-8 gap-1.5 text-xs bg-background shadow-xs font-medium border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAICall}
              disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              className="h-8 gap-1.5 text-xs bg-background shadow-xs font-medium border-primary/30 hover:bg-primary/5 hover:text-primary text-foreground"
            >
              <Bot className="h-3.5 w-3.5 text-primary" />
              AI Call
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearSelection}
              disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear Selection
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendMessage}
              disabled={bulkDeleteLoading || bulkAssignLoading || bulkEnrichLoading}
              className="h-8 gap-1.5 text-xs bg-background shadow-xs font-medium"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Send Message
            </Button>
          </div>
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
