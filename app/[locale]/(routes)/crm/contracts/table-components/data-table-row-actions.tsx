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

import { contractsSchema } from "../table-data/schema";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/modals/alert-modal";
import { useState } from "react";
import { toast } from "sonner";

import { deleteContract } from "@/actions/crm/contracts/delete-contract";
import UpdateContractForm from "../_forms/update-contract";
import { stopRowNavigation } from "../../components/table-row-navigation";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const contract = contractsSchema.parse(row.original);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const onDelete = async () => {
    setLoading(true);
    try {
      await deleteContract({ id: contract.id });
      toast.success("Contract has been deleted");
    } catch (error) {
      toast.error("Something went wrong while deleting contract. Please try again.");
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

      <UpdateContractForm
        onOpen={updateOpen}
        setOpen={setUpdateOpen}
        data={contract}
        viewDetailsButton={
          <ViewDetailsButton
            entityType="contract"
            entityId={contract.id}
            detailRoute={`/crm/contracts/${contract.id}`}
          />
        }
      />

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
              router.push(`/crm/contracts/${contract?.id}`);
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
