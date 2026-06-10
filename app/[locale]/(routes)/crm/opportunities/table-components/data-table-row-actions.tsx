"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { opportunitySchema } from "../table-data/schema";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/modals/alert-modal";
import { useState } from "react";
import { toast } from "sonner";
import { UpdateOpportunityForm } from "../components/UpdateOpportunityForm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteOpportunity } from "@/actions/crm/opportunities/delete-opportunity";

import type { OpportunityConfig } from "./columns";
import { stopRowNavigation } from "../../components/table-row-navigation";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  config: OpportunityConfig;
}

export function DataTableRowActions<TData>({
  row,
  config,
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const opportunity = opportunitySchema.parse(row.original);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);


  const onDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteOpportunity(opportunity?.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Opportunity has been deleted");
      }
    } catch (error) {
      toast.error("Something went wrong while deleting opportunity. Please try again.");
    } finally {
      setLoading(false);
      setOpen(false);
      router.refresh();
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
              <SheetTitle>Update Opportunity - {opportunity?.name}</SheetTitle>
              <div className="flex items-center gap-1 mr-8">
                <ViewDetailsButton
                  entityType="opportunity"
                  entityId={opportunity.id}
                  detailRoute={`/crm/opportunities/${opportunity.id}`}
                />
              </div>
            </div>
            <SheetDescription>Update opportunity details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <UpdateOpportunityForm
              initialData={row.original}
              setOpen={setUpdateOpen}
              saleTypes={config.saleTypes}
              saleStages={config.saleStages}
              campaigns={config.campaigns}
              contacts={config.contacts}
              currencies={config.currencies}
              categoryOptions={config.productOptions}
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
              router.push(`/crm/opportunities/${opportunity?.id}`);
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
