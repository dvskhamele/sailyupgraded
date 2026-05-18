"use client";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarClock,
  Phone,
  Users,
  FileText,
  Mail,
  Pencil,
  Trash2,
} from "lucide-react";
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

function getContactName(
  contact: NonNullable<ActivityWithLinks["links"][number]["contact"]>,
) {
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

export function ActivityEntry({
  activity,
  onDeleted,
  onUpdated,
  entityType,
  entityId,
  editLinks,
}: Props) {
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
    <div className="group relative flex gap-4 rounded-2xl border bg-background/80 p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
      {/* Left Icon */}
      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          {/* Title + Badges */}
          <div className="flex-1 min-w-0">
            <h4 className="truncate text-sm font-semibold text-foreground">
              {activity.title}
            </h4>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-md px-2 py-0.5 text-[11px]"
              >
                {TYPE_LABELS[activity.type]}
              </Badge>

              <Badge
                variant={STATUS_VARIANTS[activity.status]}
                className="rounded-md px-2 py-0.5 text-[11px]"
              >
                {activity.status}
              </Badge>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {/* Date */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mr-1 text-xs text-muted-foreground">
                  {relativeDate}
                </span>
              </TooltipTrigger>

              <TooltipContent>{absoluteDate}</TooltipContent>
            </Tooltip>

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete activity?</AlertDialogTitle>

                  <AlertDialogDescription>
                    This will permanently delete &ldquo;
                    {activity.title}
                    &rdquo;. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>

                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Description */}
        {activity.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {activity.description}
          </p>
        )}

        {/* Info Grid */}
        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {/* Contacts */}
          {contactNames.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
              <span className="font-medium text-foreground">Contact:</span>

              <span className="truncate">{contactNames.join(", ")}</span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <CalendarClock className="h-3.5 w-3.5" />

            <span>{absoluteDate}</span>
          </div>

          {/* Assigned By */}
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <span className="font-medium text-foreground">Assigned by:</span>{" "}
            {activity.created_by_user?.name ?? "Unknown"}
          </div>

          {/* Assigned To */}
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <span className="font-medium text-foreground">Assigned to:</span>{" "}
            {activity.assigned_to_user?.name ?? "Unassigned"}
          </div>
        </div>

        {/* Outcome */}
        {activity.outcome && (
          <div className="mt-3 rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Outcome:</span>{" "}
            {activity.outcome}
          </div>
        )}
      </div>

      {/* Edit Modal */}
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
