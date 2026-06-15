"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import AlertModal from "@/components/modals/alert-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UpdateTeamForm } from "../../components/UpdateTeamForm";
import { deleteTeam } from "@/actions/crm/teams/delete-team";
import { restoreTeam } from "@/actions/crm/teams/restore-team";
import { Team } from "../../table-data/schema";

interface TeamDetailActionsProps {
  team: Team & {
    members?: any[];
  };
}

export const TeamDetailActions: React.FC<TeamDetailActionsProps> = ({ team }) => {
  const [updateOpen, setUpdateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteTeam({ id: team.id });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Team has been deleted");
        router.push("/crm/teams");
      }
    } catch (error) {
      toast.error("Something went wrong while deleting team. Please try again.");
    } finally {
      setLoading(false);
      setDeleteOpen(false);
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
    <div className="flex gap-2">
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
      <Sheet open={updateOpen} onOpenChange={setUpdateOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full md:max-[771px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Update Team - {team.name}</SheetTitle>
            <SheetDescription>Update team details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <UpdateTeamForm initialData={team} onFinish={() => setUpdateOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      {team.deletedAt ? (
        <Button size="sm" onClick={onRestore} disabled={loading}>
          Restore
        </Button>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={loading}
        >
          Delete
        </Button>
      )}
    </div>
  );
};