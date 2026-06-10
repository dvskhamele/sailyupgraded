"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { leadSchema } from "../table-data/schema";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/modals/alert-modal";
import { useState } from "react";
import { toast } from "sonner";
import { UpdateLeadForm } from "../components/UpdateLeadForm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { stopRowNavigation } from "../../components/table-row-navigation";
import { localLeadRepository } from "@/lib/offline-first/storage";
import { deleteLead } from "@/actions/crm/leads/delete-lead";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

type ConfigItem = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};
type ProductItem = { id: string; name: string };

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  accounts: AccountItem[];
  contactTypes: ConfigItem[];
  leadSources: ConfigItem[];
  leadStatuses: ConfigItem[];
  leadTypes: ConfigItem[];
  products?: ProductItem[];
  onDataChange?: () => void | Promise<void>;
}

export function DataTableRowActions<TData>({
  row,
  accounts,
  contactTypes,
  leadSources,
  leadStatuses,
  leadTypes,
  products = [],
  onDataChange,
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const lead = leadSchema.parse(row.original);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);


  const onDelete = async () => {
    setLoading(true);
    try {
      // 1. Delete from server (MariaDB)
      const result = await deleteLead(lead.id);
      
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      // 2. Delete from local (IndexedDB) to update UI immediately
      await localLeadRepository.delete(lead.id);
      
      toast.success("Lead has been deleted");
      await onDataChange?.();
      router.refresh();
    } catch (error) {
      console.error("[onDelete]", error);
      toast.error("Something went wrong while deleting lead. Please try again.");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
      <Sheet open={updateOpen} onOpenChange={setUpdateOpen}>
        <SheetContent
          className="w-full md:max-w-[771px] overflow-y-auto"
          onClick={stopRowNavigation}
          onKeyDown={stopRowNavigation}
        >
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Update lead - {lead?.firstName} {lead?.lastName}</SheetTitle>
              <div className="flex items-center gap-1 mr-8">
                <ViewDetailsButton
                  entityType="lead"
                  entityId={lead.id}
                  detailRoute={`/crm/leads/${lead.id}`}
                />
              </div>
            </div>
            <SheetDescription>Update lead details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <UpdateLeadForm
              initialData={row.original}
              setOpen={setUpdateOpen}
              accounts={accounts}
              contactTypes={contactTypes}
              leadSources={leadSources}
              leadStatuses={leadStatuses}
              leadTypes={leadTypes}
              products={products}
              onDataChange={onDataChange}
            />
          </div>
        </SheetContent>
      </Sheet>
      <div data-row-action onClick={stopRowNavigation} onKeyDown={stopRowNavigation}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            onClick={stopRowNavigation}
          >
            <DotsHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]" onClick={stopRowNavigation}>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/crm/leads/${lead?.id}`);
            }}
          >
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(event) => {
            event.stopPropagation();
            setUpdateOpen(true);
          }}>
            Update
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}>
            Delete
            <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </>
  );
}
