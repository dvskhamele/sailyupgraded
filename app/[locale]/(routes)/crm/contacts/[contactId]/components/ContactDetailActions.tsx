"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UpdateContactForm } from "../../components/UpdateContactForm";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

type ConfigItem = { id: string; name: string };

interface ContactDetailActionsProps {
  contact: any;
  accounts?: { id: string; name: string; accountProducts?: { product?: { id: string; name: string } | null }[] }[];
  contactTypes: ConfigItem[];
  leadSources?: ConfigItem[];
  leadStatuses?: ConfigItem[];
  leadTypes?: ConfigItem[];
  products?: ConfigItem[];
  saleStages?: ConfigItem[];
}

export function ContactDetailActions({
  contact,
  accounts = [],
  contactTypes,
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  products = [],
  saleStages = [],
}: ContactDetailActionsProps) {
  const [updateOpen, setUpdateOpen] = useState(false);

  return (
    <>
      <Sheet open={updateOpen} onOpenChange={setUpdateOpen}>
        <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>
                Update Contact - {contact?.first_name} {contact?.last_name}
              </SheetTitle>
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
              initialData={contact}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            data-testid="contact-detail-actions-btn"
          >
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onClick={() => setUpdateOpen(true)}>
            Update
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
