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

import { TeamSchema } from "../table-data/schema";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/modals/alert-modal";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteTeam } from "@/actions/crm/teams/delete-team";
import { restoreTeam } from "@/actions/crm/teams/restore-team";
import { stopRowNavigation } from "../../components/table-row-navigation";
import { UpdateTeamForm } from "../components/UpdateTeamForm";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const team = TeamSchema.parse(row.original);

  const [open, setOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [loading, setLoading] = useState(false);


  const onDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteTeam({ id: team.id });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Team has been deleted");
      }
    } catch (error) {
      toast.error("Something went wrong while deleting team. Please try again.");
    } finally {
      setLoading(false);
      setOpen(false);
      router.refresh();
    }
  };

  const onRestore = async () => {
    setLoading(true);
    try {
      const result = await restoreTeam({ teamId: team.id });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Team has been restored");
      }
    } catch (error) {
      toast.error("Something went wrong while restoring team. Please try again.");
    } finally {
      setLoading(false);
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
            <SheetTitle>Update Team - {team?.name}</SheetTitle>
            <SheetDescription>Update team details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <UpdateTeamForm initialData={row.original as any} onFinish={() => setUpdateOpen(false)} />
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
        <DropdownMenuContent align="end" className="w-[260px]" onClick={stopRowNavigation}>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/crm/teams/${team?.id}`);
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
          {(row.original as any).deletedAt ? (
            <DropdownMenuItem onClick={(event) => {
              event.stopPropagation();
              onRestore();
            }}>
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}>
              Delete
              <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </>
  );
}
