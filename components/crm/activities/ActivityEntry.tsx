"use client";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarClock,
  Clock,
  MapPin,
  Phone,
  Users,
  FileText,
  Mail,
  Pencil,
  Trash2,
  Bot,
  Sparkles,
  MessageSquare,
  PlayCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { deleteRetailAIActivity } from "@/actions/crm/retail-ai-activities/delete-retail-ai-activity";
import { ActivityForm } from "./ActivityForm";
import { RetailAIActivityDetails } from "./RetailAIActivityDetails";
import { cn } from "@/lib/utils";
import type { ActivityWithLinks } from "@/actions/crm/activities/get-activities-by-entity";
import type { RetailAIActivityAIFields } from "@/actions/crm/retail-ai-activities/types";

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

function normalizeSentiment(value?: string | null) {
  const normalized = value?.toLowerCase();
  if (normalized === "positive" || normalized === "negative" || normalized === "neutral") {
    return normalized;
  }
  return null;
}

function sentimentLabel(value: "positive" | "neutral" | "negative") {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getRetailAIActivityDetails(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;

  const root = metadata as Record<string, any>;
  const details = root.retailAI;
  if (root.source !== "retail-ai" || !details || typeof details !== "object") {
    return null;
  }

  return {
    customerName:
      typeof details.customerName === "string" ? details.customerName : null,
    customerEmail:
      typeof details.customerEmail === "string" ? details.customerEmail : null,
    customerPhone:
      typeof details.customerPhone === "string" ? details.customerPhone : null,
    scheduledMeetingTime:
      typeof details.scheduledMeetingTime === "string" ||
      details.scheduledMeetingTime instanceof Date
        ? details.scheduledMeetingTime
        : null,
  };
}

interface Props {
  activity: ActivityWithLinks & Partial<RetailAIActivityAIFields>;
  onDeleted: (id: string) => void;
  onUpdated: (activity: ActivityWithLinks) => void;
  entityType?: string;
  entityId?: string;
  editLinks?: Array<{ entityType: string; entityId: string }>;
  activityModule?: "crm" | "retail-ai";
}

export function ActivityEntry({
  activity,
  onDeleted,
  onUpdated,
  entityType,
  entityId,
  editLinks,
  activityModule = "crm",
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relativeDate, setRelativeDate] = useState("");
  const [absoluteDate, setAbsoluteDate] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [scheduledMeetingTime, setScheduledMeetingTime] = useState("");

  const isRetailAI = activity.isRetailAI || activityModule === "retail-ai";
  const Icon = isRetailAI ? Bot : TYPE_ICONS[activity.type];
  const retailAIActivityDetails = !isRetailAI
    ? getRetailAIActivityDetails(activity.metadata)
    : null;
  
  // New Fields Logic
  const sentiment = normalizeSentiment(activity.user_sentiment || activity.sentiment);
  const isSuccessful = activity.call_successful === 'accepted' || activity.call_successful === 'yes' || activity.callSuccessful;
  const aiSummary = activity.call_summary || activity.aiGeneratedSummary;
  const customerName = activity.customer_name || (activity.links.find(l => l.entityType === 'contact')?.contact ? getContactName(activity.links.find(l => l.entityType === 'contact')!.contact!) : 'Anonymous');
  const duration = activity.call_duration || activity.duration;
  
  // New UI helper fields
  const insuranceType = activity.insurance_interest || activity.consultation_type;
  const locationInfo = [activity.state, activity.location].filter(Boolean).join(", ");
  const contactPhone = activity.phone_number;
  const contactEmail = activity.email;
  const callId = activity.call_id || activity.conversationId;
  const contactNames = activity.links
    .filter((link) => link.entityType === "contact" && link.contact)
    .map((link) => getContactName(link.contact!));

  useEffect(() => {
    const activityDate = new Date(activity.date);
    setRelativeDate(formatDistanceToNow(activityDate, { addSuffix: true }));
    setAbsoluteDate(activityDate.toLocaleString());
    
    if (activity.appointment_time) {
      setAppointmentDate(new Date(activity.appointment_time).toLocaleString(undefined, { 
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      }));
    } else {
      setAppointmentDate("");
    }

    if (retailAIActivityDetails?.scheduledMeetingTime) {
      const scheduledMeetingDate = new Date(retailAIActivityDetails.scheduledMeetingTime);
      setScheduledMeetingTime(
        Number.isNaN(scheduledMeetingDate.getTime())
          ? ""
          : scheduledMeetingDate.toLocaleString(),
      );
    } else {
      setScheduledMeetingTime("");
    }
  }, [activity.date, activity.appointment_time, retailAIActivityDetails?.scheduledMeetingTime]);

  const handleDelete = async () => {
    setDeleting(true);
    const result =
      activityModule === "retail-ai"
        ? await deleteRetailAIActivity(activity.id)
        : await deleteActivity(activity.id);
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
            <h4 className="truncate text-sm font-semibold text-foreground flex items-center gap-2">
              {isRetailAI ? (
                <>
                  <span className="text-blue-600 font-bold text-base">{customerName}</span>
                  {insuranceType && (
                    <span className="text-muted-foreground font-medium text-xs bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      {insuranceType}
                    </span>
                  )}
                </>
              ) : (
                activity.title
              )}
            </h4>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-md px-2 py-0.5 text-[11px]"
              >
                {TYPE_LABELS[activity.type] || 'Meeting'}
              </Badge>

              <Badge
                variant={STATUS_VARIANTS[activity.status]}
                className="rounded-md px-2 py-0.5 text-[11px]"
              >
                {activity.status}
              </Badge>

              {isRetailAI && (
                <>
                  {sentiment && (
                    <Badge variant="outline" className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] gap-1",
                      sentiment === 'positive' ? 'text-green-600 bg-green-50 border-green-200' : 
                      sentiment === 'negative' ? 'text-red-600 bg-red-50 border-red-200' : 
                      'text-blue-600 bg-blue-50 border-blue-200'
                    )}>
                      {sentimentLabel(sentiment)}
                    </Badge>
                  )}
                  {(activity.call_successful || activity.callSuccessful !== undefined) && (
                    <Badge variant={isSuccessful ? "default" : "destructive"} className="rounded-md px-2 py-0.5 text-[11px] bg-green-600">
                      {isSuccessful ? "✓ Completed" : "✕ Failed"}
                    </Badge>
                  )}
                  {duration && (
                    <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground border-dashed">
                      {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                    </Badge>
                  )}
                  {activity.combined_cost && (
                    <Badge variant="outline" className="rounded-md px-2 py-0.5 text-[11px] text-green-600 bg-green-50 border-green-200">
                      ${Number(activity.combined_cost).toFixed(2)}
                    </Badge>
                  )}
                </>
              )}
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
          {isRetailAI ? (
            <>
              {contactPhone && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50/50 px-3 py-2 border border-blue-100/50">
                  <Phone className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-blue-700 font-medium">{contactPhone}</span>
                </div>
              )}
              {contactEmail && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50/50 px-3 py-2 border border-blue-100/50">
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-blue-700 font-medium truncate">{contactEmail}</span>
                </div>
              )}
              {locationInfo && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-700">{locationInfo}</span>
                </div>
              )}
              {appointmentDate && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 border border-amber-100">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-700 font-semibold">
                    {appointmentDate}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Contacts */}
              {contactNames.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Contact:</span>
                  <span className="truncate">{contactNames.join(", ")}</span>
                </div>
              )}

              {retailAIActivityDetails?.customerName && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Customer Name:</span>
                  <span className="truncate">{retailAIActivityDetails.customerName}</span>
                </div>
              )}

              {retailAIActivityDetails?.customerEmail && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Customer Email:</span>
                  <span className="truncate">{retailAIActivityDetails.customerEmail}</span>
                </div>
              )}

              {retailAIActivityDetails?.customerPhone && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Customer Phone:</span>
                  <span className="truncate">{retailAIActivityDetails.customerPhone}</span>
                </div>
              )}

              {scheduledMeetingTime && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">Scheduled Meeting Time:</span>
                  <span className="truncate">{scheduledMeetingTime}</span>
                </div>
              )}
            </>
          )}

          {/* Date */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{absoluteDate} {duration && isRetailAI ? `(${Math.floor(duration / 60)}m ${duration % 60}s)` : ''}</span>
          </div>

          {!isRetailAI && (
            <>
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
            </>
          )}
        </div>

        {/* Outcome */}
        {activity.outcome && (
          <div className="mt-3 rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Outcome:</span>{" "}
            {activity.outcome}
          </div>
        )}

        {isRetailAI && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              {activity.aiSource && (
                <div className="rounded-lg bg-blue-50/50 border border-blue-100/50 px-3 py-2">
                  <span className="font-medium text-blue-700">AI source:</span>{" "}
                  {activity.aiSource}
                </div>
              )}
              {activity.aiStatus && (
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">AI status:</span>{" "}
                  {activity.aiStatus}
                </div>
              )}
              {activity.aiConfidenceScore !== null &&
                activity.aiConfidenceScore !== undefined && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium text-foreground">AI confidence:</span>
                      <span>{Number(activity.aiConfidenceScore).toFixed(0)}%</span>
                    </div>
                    <Progress value={Number(activity.aiConfidenceScore)} className="h-1" />
                  </div>
                )}
              {aiSummary && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 sm:col-span-2">
                  <span className="font-medium text-foreground">AI summary:</span>{" "}
                  {aiSummary}
                </div>
              )}
              {activity.aiInsights && (
                <div className="rounded-lg bg-purple-50/50 border border-purple-100/50 px-3 py-2 sm:col-span-2 text-black">
                  <span className="font-medium text-purple-700">AI insights:</span>{" "}
                  {activity.aiInsights}
                </div>
              )}
            </div>

            {/* AI Actions */}
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg text-[11px] gap-1.5 border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    View AI Analysis
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="sr-only">Retail AI Analysis Details</DialogTitle>
                  </DialogHeader>
                  <RetailAIActivityDetails activity={activity} />
                </DialogContent>
              </Dialog>

              {activity.transcript && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-[11px] gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      View Transcript
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Call Transcript</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      {Array.isArray(activity.transcript) ? (
                        activity.transcript.map((msg: any, i: number) => (
                          <div key={i} className={cn(
                            "flex flex-col gap-1 rounded-xl p-3 text-sm",
                            msg.role === 'agent' ? "bg-blue-50 border border-blue-100 ml-8" : "bg-muted/50 border mr-8"
                          )}>
                            <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                              {msg.role === 'agent' ? 'AI Assistant' : 'Customer'}
                            </span>
                            <p>{msg.content}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{String(activity.transcript)}</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {activity.recordingUrl && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg text-[11px] gap-1.5"
                  onClick={() => window.open(activity.recordingUrl!, '_blank')}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Play Recording
                </Button>
              )}

              {/* {activity.publicLogUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 rounded-lg text-[11px] gap-1.5"
                  onClick={() => window.open(activity.publicLogUrl!, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Logs
                </Button>
              )} */}
            </div>
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
          activityModule={isRetailAI ? "retail-ai" : "crm"}
          onSaved={onUpdated}
        />
      )}
    </div>
  );
}
