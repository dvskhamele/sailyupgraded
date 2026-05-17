"use client";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, Phone, Users, FileText, Mail, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteActivity } from "@/actions/crm/activities/delete-activity";
import { ActivityForm } from "./ActivityForm";
import type { ActivityWithLinks } from "@/actions/crm/activities/get-activities-by-entity";

const TYPE_ICONS = {
  call: Phone,
  meeting: Users,
  note: FileText,
  email: Mail,
} as const;

const TYPE_LABELS = {
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  email: "Email",
} as const;

const STATUS_VARIANTS = {
  scheduled: "outline",
  completed: "default",
  cancelled: "secondary",
} as const;

function getContactName(contact: NonNullable<ActivityWithLinks["links"][number]["contact"]>) {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    contact.email ||
    "Contact"
  );
}

interface Props {
  activity: ActivityWithLinks;
  onDeleted: (id: string) => void;
  onUpdated: (activity: ActivityWithLinks) => void;
  entityType?: string;
  entityId?: string;
  editLinks?: Array<{ entityType: string; entityId: string }>;
}

export function ActivityEntry({ activity, onDeleted, onUpdated, entityType, entityId, editLinks }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relativeDate, setRelativeDate] = useState("");
  const [absoluteDate, setAbsoluteDate] = useState("");

  const Icon = TYPE_ICONS[activity.type];
  const contactNames = activity.links
    .filter((link) => link.entityType === "contact" && link.contact)
    .map((link) => getContactName(link.contact!));

  useEffect(() => {
    const activityDate = new Date(activity.date);
    setRelativeDate(formatDistanceToNow(activityDate, { addSuffix: true }));
    setAbsoluteDate(activityDate.toLocaleString());
  }, [activity.date]);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteActivity(activity.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Activity deleted");
      onDeleted(activity.id);
    }
  };

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <div className="mt-1 flex-shrink-0 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{activity.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {TYPE_LABELS[activity.type]}
              </Badge>
              <Badge variant={STATUS_VARIANTS[activity.status]} className="text-xs">
                {activity.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-default">
                  {relativeDate}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {absoluteDate}
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={deleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete activity?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &ldquo;{activity.title}&rdquo;. This action cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {activity.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {activity.description}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {absoluteDate}
        </p>
        {activity.outcome && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Outcome:</span> {activity.outcome}
          </p>
        )}
        {activity.assigned_to_user && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Assigned to:</span>{" "}
            {activity.assigned_to_user.name ?? "Unassigned"}
          </p>
        )}
        {contactNames.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Contact:</span> {contactNames.join(", ")}
          </p>
        )}
      </div>

      {editOpen && (
        <ActivityForm
          open={editOpen}
          onOpenChange={setEditOpen}
          entityType={entityType}
          entityId={entityId}
          links={editLinks}
          activity={activity}
          onSaved={onUpdated}
        />
      )}
    </div>
  );
}
