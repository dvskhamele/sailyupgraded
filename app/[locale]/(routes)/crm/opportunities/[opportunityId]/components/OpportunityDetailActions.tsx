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
import AlertModal from "@/components/modals/alert-modal";
import { toast } from "sonner";
import { deleteOpportunity } from "@/actions/crm/opportunities/delete-opportunity";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const onDelete = async () => {
    setDeleteLoading(true);
    try {
      const result = await deleteOpportunity(opportunity?.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Opportunity has been deleted");
        router.push("/crm/opportunities");
      }
    } catch (error) {
      toast.error("Something went wrong while deleting opportunity. Please try again.");
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
      setUpdateOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={deleteLoading}
      />
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
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </Button>
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
