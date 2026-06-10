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
import { UpdateContactForm } from "../components/UpdateContactForm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteContact } from "@/actions/crm/contacts/delete-contact";
import { stopRowNavigation } from "../../components/table-row-navigation";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

type ConfigItem = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  contactTypes: ConfigItem[];
  accounts: AccountItem[];
  leadSources?: ConfigItem[];
  leadStatuses?: ConfigItem[];
  leadTypes?: ConfigItem[];
  products?: ConfigItem[];
  saleStages?: ConfigItem[];
}

export function DataTableRowActions<TData>({
  row,
  contactTypes,
  accounts,
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  products = [],
  saleStages = [],
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const contact = opportunitySchema.parse(row.original);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);


  const onDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteContact(contact?.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Contact has been deleted");
      }
    } catch (error) {
      toast.error("Something went wrong while deleting contact. Please try again.");
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
              <SheetTitle>Update Contact - {contact?.first_name} {contact?.last_name}</SheetTitle>
              <div className="flex items-center gap-1 mr-8">
                <ViewDetailsButton
                  entityType="contact"
                  entityId={contact.id}
                  detailRoute={`/crm/contacts/${contact.id}`}
                />
              </div>
            </div>
            <SheetDescription>Update contact details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <UpdateContactForm
              initialData={row.original}
              setOpen={setUpdateOpen}
              accounts={accounts}
              contactTypes={contactTypes}
              leadSources={leadSources}
              leadStatuses={leadStatuses}
              leadTypes={leadTypes}
              products={products}
              saleStages={saleStages}
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
              router.push(`/crm/contacts/${contact?.id}`);
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
