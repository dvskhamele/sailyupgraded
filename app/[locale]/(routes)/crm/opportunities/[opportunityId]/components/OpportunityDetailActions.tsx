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
import { UpdateOpportunityForm } from "../../components/UpdateOpportunityForm";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

type ConfigItem = { id: string; name: string };

interface OpportunityDetailActionsProps {
  opportunity: any;
  saleTypes: ConfigItem[];
  saleStages: ConfigItem[];
  campaigns: ConfigItem[];
  contacts?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  }[];
  currencies: { code: string; name: string; symbol: string }[];
  categoryOptions?: string[];
}

export function OpportunityDetailActions({
  opportunity,
  saleTypes,
  saleStages,
  campaigns,
  contacts = [],
  currencies,
  categoryOptions = [],
}: OpportunityDetailActionsProps) {
  const [updateOpen, setUpdateOpen] = useState(false);

  return (
    <>
      <Sheet open={updateOpen} onOpenChange={setUpdateOpen}>
        <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
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
              initialData={opportunity}
              setOpen={setUpdateOpen}
              saleTypes={saleTypes}
              saleStages={saleStages}
              campaigns={campaigns}
              contacts={contacts}
              currencies={currencies}
              categoryOptions={categoryOptions}
            />
          </div>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            data-testid="opportunity-detail-actions-btn"
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
