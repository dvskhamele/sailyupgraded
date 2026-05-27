"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Bot,
  MessageSquareMore,
  Calendar,
  DollarSign,
  Loader2,
  Mic,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { ThumbsDown } from "lucide-react";
import { RetellWebClient } from "retell-client-js-sdk";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  crm_Opportunities,
  crm_Opportunities_Sales_Stages,
} from "@prisma/client";

import { DotsHorizontalIcon, PlusCircledIcon } from "@radix-ui/react-icons";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { NewOpportunityForm } from "../../opportunities/components/NewOpportunityForm";
import { UpdateOpportunityForm } from "../../opportunities/components/UpdateOpportunityForm";
import { ImportOpportunitiesDialog } from "../../opportunities/components/ImportOpportunitiesDialog";
import { setInactiveOpportunity } from "@/actions/crm/opportunity/dashboard/set-inactive";
import { updateOpportunity } from "@/actions/crm/opportunities/update-opportunity";
import { createProduct } from "@/actions/crm/products/create-product";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/use-hydrated";
import { CategoryFilter } from "./CategoryFilter";
import { filterOpportunitiesByCategory } from "@/lib/opportunity-categories";
import { sendSMS } from "@/actions/crm/sms/send-sms";
import { parseOpportunityProducts } from "@/lib/opportunity-products";
import { formatCurrencyDisplay } from "@/lib/currency-input";
import { stopRowNavigation } from "../../components/table-row-navigation";

interface CRMKanbanProps {
  salesStages: crm_Opportunities_Sales_Stages[];
  opportunities: crm_Opportunities[];
  crmData: any;
}

type Column = crm_Opportunities_Sales_Stages & {
  opportunities: crm_Opportunities[];
};

const LOST_DROP_ID = "lost-column";

type RetellCallResponse = {
  accessToken: string;
  callId: string;
  agentId?: string;
  agentVersion?: number;
  agentName?: string;
};

type RetellCallErrorResponse = {
  error?: string;
};

type RetellAgentOption = {
  id: string;
  version?: number;
  name: string;
  isPublished: boolean;
};

type RetellAgentsResponse =
  | {
      agents: RetellAgentOption[];
    }
  | RetellCallErrorResponse;

type RetellAgentScriptResponse =
  | {
      script: string;
    }
  | RetellCallErrorResponse;

type RetellTranscriptLine = {
  role?: string;
  content?: string;
};

type RetellCardCallState = {
  isLoading: boolean;
  isCallActive: boolean;
  speaker: "agent" | "user" | null;
  callId: string | null;
};

type OpportunityPhoneCallStatus =
  | "idle"
  | "calling"
  | "active"
  | "ended"
  | "failed"
  | "booked";

type OpportunityPhoneCallState = {
  status: OpportunityPhoneCallStatus;
  callId?: string;
  error?: string;
};

type RetellPhoneCallResponse =
  | {
      success: true;
      callId: string;
      agentId?: string;
      status?: string;
    }
  | RetellCallErrorResponse;

type RetellSmsMessageResponse =
  | {
      success: true;
      chatId: string;
      agentId?: string;
      status?: string;
      messages?: Array<{
        role?: string;
        content?: string;
      }>;
    }
  | RetellCallErrorResponse;

function getOpportunityAmount(opportunity: crm_Opportunities) {
  const amount = (opportunity as any).amount ?? opportunity.budget ?? 0;
  return Number(amount) || 0;
}

function StageStats({ opportunities }: { opportunities: crm_Opportunities[] }) {
  const totalCards = opportunities.length;
  const totalRevenue = opportunities.reduce(
    (sum, opportunity) => sum + getOpportunityAmount(opportunity),
    0,
  );

  return (
    <div className="flex items-center px-1 py-2 justify-between mb-2 bg-white border rounded shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
          {formatCurrencyDisplay(totalRevenue, "USD")}
        </div>
      </div>
      {/* <div className="h-6 w-px bg-gray-200 mx-3" /> */}

      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-full">
          {totalCards}
        </div>
      </div>
    </div>
  );
}

function RetellAssistantDialog({
  open,
  onOpenChange,
  onAgentSelect,
  currentAgentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentSelect: (agent: RetellAgentOption) => void;
  currentAgentId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("Voice AI Retail");
  const [agents, setAgents] = useState<RetellAgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(currentAgentId || "");
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [selectedAgentScript, setSelectedAgentScript] = useState("");

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

  useEffect(() => {
    if (currentAgentId) {
      setSelectedAgentId(currentAgentId);
    }
  }, [currentAgentId]);

  useEffect(() => {
    if (!open || agents.length > 0) {
      return;
    }

    let isCurrent = true;

    async function loadAgents() {
      setIsLoadingAgents(true);
      setError(null);

      try {
        const response = await fetch("/api/retell/agents", {
          cache: "no-store",
        });
        const payload = (await response.json()) as RetellAgentsResponse;

        if (!response.ok || !("agents" in payload)) {
          const message =
            "error" in payload
              ? payload.error
              : "Retell agents are not available";
          throw new Error(message ?? "Retell agents are not available");
        }

        if (!isCurrent) {
          return;
        }

        setAgents(payload.agents);
        if (!selectedAgentId) {
          const firstAgent =
            payload.agents.find((agent) => agent.isPublished) ??
            payload.agents[0];
          if (firstAgent) {
            setSelectedAgentId(firstAgent.id);
            setAgentName(firstAgent.name);
          }
        }
      } catch (error) {
        if (isCurrent) {
          setError(
            error instanceof Error
              ? error.message
              : "Retell agents are not available",
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoadingAgents(false);
        }
      }
    }

    loadAgents();

    return () => {
      isCurrent = false;
    };
  }, [agents.length, open, selectedAgentId]);

  useEffect(() => {
    if (!open || !selectedAgentId) {
      return;
    }

    let isCurrent = true;

    async function loadAgentScript() {
      setIsLoadingScript(true);

      try {
        const response = await fetch(
          `/api/retell/agents/${encodeURIComponent(selectedAgentId)}/script`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as RetellAgentScriptResponse;

        if (!response.ok || !("script" in payload)) {
          if (isCurrent) {
            setSelectedAgentScript("");
          }
          return;
        }

        if (isCurrent) {
          setSelectedAgentScript(payload.script);
        }
      } finally {
        if (isCurrent) {
          setIsLoadingScript(false);
        }
      }
    }

    loadAgentScript();

    return () => {
      isCurrent = false;
    };
  }, [open, selectedAgentId]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const handleSelectAgent = () => {
    if (selectedAgent) {
      onAgentSelect(selectedAgent);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Select Voice AI Agent
          </DialogTitle>
          <DialogDescription>
            {error
              ? error
              : "Choose an agent to be used for outbound calls."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Retell agent</p>
            {selectedAgent ? <Badge>Selected</Badge> : null}
          </div>
          <Select
            value={selectedAgentId}
            onValueChange={(agentId) => {
              const nextAgent = agents.find((agent) => agent.id === agentId);
              setSelectedAgentId(agentId);
              setAgentName(nextAgent?.name ?? "Voice AI Retail");
              setError(null);
            }}
            disabled={isLoadingAgents}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingAgents ? "Loading agents..." : "Select Retell agent"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.isPublished ? " (published)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Script Preview</p>
            {selectedAgent?.version !== undefined ? (
              <Badge variant="secondary">v{selectedAgent.version}</Badge>
            ) : null}
          </div>
          <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-sm bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            {isLoadingAgents || isLoadingScript ? (
              <span>Loading script...</span>
            ) : selectedAgentScript ? (
              selectedAgentScript
            ) : selectedAgent ? (
              <span>No script found for this agent.</span>
            ) : (
              <span>Select an agent to view its script.</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            onClick={handleSelectAgent}
            disabled={isLoadingAgents || !selectedAgent}
          >
            Select Agent
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initColumns(
  opps: crm_Opportunities[],
  stages: crm_Opportunities_Sales_Stages[],
  selectedCategories: string[],
): Column[] {
  const fallbackStageId = stages[0]?.id;
  const filteredOpportunities = filterOpportunitiesByCategory(
    opps,
    selectedCategories,
  );

  return stages.map((stage) => ({
    ...stage,
    opportunities: filteredOpportunities.filter(
      (o: any) =>
        (o.sales_stage ?? fallbackStageId) === stage.id &&
        o.status === "ACTIVE",
    ),
  }));
}

function getLostOpportunities(
  opps: crm_Opportunities[],
  selectedCategories: string[],
) {
  return filterOpportunitiesByCategory(opps, selectedCategories).filter(
    (o: any) => o.status === "INACTIVE",
  );
}

function getOpportunityDisplayName(opportunity: crm_Opportunities) {
  return (
    (opportunity as any).clientName?.trim() ||
    (opportunity as any).assigned_to_user?.name ||
    ""
  );
}

function getOpportunityClientName(opportunity: crm_Opportunities) {
  return (opportunity as any).clientName?.trim() || "";
}

function getOpportunityPrimaryContact(opportunity: crm_Opportunities) {
  const contacts = (opportunity as any).contacts;
  if (!Array.isArray(contacts)) {
    return null;
  }

  return contacts[0]?.contact ?? null;
}

function getOpportunityMemberName(opportunity: crm_Opportunities) {
  const contact = getOpportunityPrimaryContact(opportunity);
  const contactName = [contact?.first_name, contact?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    contactName ||
    getOpportunityClientName(opportunity) ||
    getOpportunityDisplayName(opportunity) ||
    opportunity.name ||
    "Customer"
  );
}

function getOpportunityCallTarget(opportunity: crm_Opportunities) {
  const contact = getOpportunityPrimaryContact(opportunity);
  const phone =
    contact?.phone?.trim() ||
    contact?.mobile_phone?.trim() ||
    contact?.office_phone?.trim() ||
    "";

  return {
    memberId: contact?.id ?? "",
    memberName: getOpportunityMemberName(opportunity),
    phone,
    email: contact?.email?.trim() || contact?.personal_email?.trim() || "",
    state: contact?.state?.trim() || "",
  };
}

function getOpportunityProduct(opportunity: crm_Opportunities) {
  return parseOpportunityProducts((opportunity as any).category);
}

function OpportunityAiMessageDialog({
  open,
  onOpenChange,
  opportunity,
  message,
  onMessageChange,
  onSend,
  isSending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: crm_Opportunities | null;
  message: string;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  isSending: boolean;
}) {
  const target = opportunity ? getOpportunityCallTarget(opportunity) : null;
  const canSend =
    Boolean(opportunity && target?.phone && message.trim()) &&
    !isSending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareMore className="h-5 w-5 text-sky-700" />
            Send SMS Message
          </DialogTitle>
          <DialogDescription>
            Send a direct SMS message via Twilio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">Lead</span>
              <span className="min-w-0 truncate text-right font-medium">
                {target?.memberName ?? "No lead selected"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">Contact</span>
              <span className="min-w-0 truncate text-right font-medium">
                {target?.phone || "No phone number"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opportunity-ai-message">Message</Label>
            <Textarea
              id="opportunity-ai-message"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder="Type your message here..."
              className="min-h-32 resize-y"
              disabled={isSending}
            />
            {!target?.phone && (
              <p className="text-xs text-destructive">
                This opportunity does not have a linked lead phone number.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSend} disabled={!canSend}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquareMore className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Draggable Opportunity Card
function OpportunityCard({
  opportunity,
  onThumbsDown,
  onOpenEdit,
  onOpenAiMessage,
  stage,
  salesStages,
  nowMs,
  phoneCallState,
  onStartPhoneCall,
}: any) {
  const opportunityProducts = getOpportunityProduct(opportunity);
  const callState = (phoneCallState ?? {
    status: "idle",
  }) as OpportunityPhoneCallState;
  const isCalling = callState.status === "calling";
  const isCallActive = callState.status === "active";
  const isCallFailed = callState.status === "failed";
  const isCallBooked = callState.status === "booked";
  const callTarget = getOpportunityCallTarget(opportunity);
  const canStartCall = !isCalling && !isCallActive;
  const callStatusLabel =
    callState.error ??
    (isCalling
      ? "Calling lead..."
      : isCallActive
        ? "Call active"
        : isCallBooked
          ? "Booked"
          : isCallFailed
            ? "Call failed"
            : callState.status === "ended"
              ? "Call ended"
              : callTarget.phone
                ? "Call lead"
                : "No phone");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // onClick={() => onOpenEdit(opportunity)}
      className="group relative my-3 w-full cursor-grab rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:cursor-grabbing"
    >
      {/* Gradient Border Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition"></div>

      {/* HEADER */}
      <CardHeader className="relative z-10 p-4 pb-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-indigo-600 transition">
            {opportunity.name}
          </h3>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DotsHorizontalIcon
                className="w-4 h-4 text-gray-500 hover:text-gray-700 transition"
                onClick={(e) => e.stopPropagation()}
              />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" onClick={stopRowNavigation}>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenEdit(opportunity);
                }}
              >
                ✏️ Update
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* CONTENT */}
      <CardContent className="relative z-10 px-4 pb-3 text-xs text-gray-600 space-y-3">
        {/* DESCRIPTION */}
        <p className="line-clamp-2 text-gray-500">{opportunity.description}</p>

        {/* AMOUNT */}
      {/* AMOUNT */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <DollarSign className="w-4 h-4 text-green-600" />
    <span className="text-sm font-medium text-gray-600">
      AMOUNT
    </span>
  </div>

  <span className="font-semibold text-gray-900 text-sm">
    {formatCurrencyDisplay(
      opportunity.budget,
      (opportunity as any).currency || "USD"
    )}
  </span>
</div>

{/* CLOSE DATE */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Calendar className="w-4 h-4 text-blue-600" />
    <span className="text-sm font-medium text-gray-600">
      CLOSE DATE
    </span>
  </div>

  <span
    className={`text-xs font-semibold px-2 py-1 rounded-full ${
      opportunity.close_date &&
      nowMs !== null &&
      new Date(opportunity.close_date).getTime() < nowMs
        ? "bg-red-100 text-red-600"
        : "bg-indigo-100 text-indigo-600"
    }`}
  >
    {opportunity.close_date
      ? format(new Date(opportunity.close_date), "dd MMM yyyy")
      : "No close date"}
  </span>
</div>
      </CardContent>

      {/* FOOTER */}
      <CardFooter className="relative z-10 flex justify-between items-center bg-gray-50/60 px-4 py-3 rounded-b-2xl">
        {/* USER */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-8 h-8 ring-2 ring-white shadow-sm">
            <AvatarImage
              src={opportunity.assigned_to_user?.avatar || "/images/nouser.png"}
            />
          </Avatar>

          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
            {getOpportunityClientName(opportunity) ||
              getOpportunityDisplayName(opportunity)}
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={`Start outbound AI call for ${callTarget.memberName}`}
              title={callStatusLabel}
              disabled={!canStartCall}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onStartPhoneCall(opportunity);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                isCallActive || isCallBooked
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : isCallFailed
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {isCalling ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isCallActive || isCallBooked ? (
                <Mic className="h-5 w-5" />
              ) : isCallFailed ? (
                <PhoneOff className="h-5 w-5" />
              ) : (
                <PhoneCall className="h-5 w-5" />
              )}
            </button>
            <span className="sr-only">{callStatusLabel}</span>

            <button
              type="button"
              aria-label={`Open AI messages for ${callTarget.memberName}`}
              title="AI messages"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenAiMessage(opportunity);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquareMore  className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRODUCTS */}
        {opportunityProducts.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end">
            {opportunityProducts.map((product) => (
              <Badge
                key={product}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm"
              >
                {product}
              </Badge>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function OpportunityCardStatic({
  opportunity,
  onOpenEdit,
  stage,
  salesStages,
  nowMs,
}: any) {
  const opportunityProducts = getOpportunityProduct(opportunity);
  return (
    <Card
      className="my-2 w-full cursor-pointer border border-amber-100 bg-gradient-to-br from-white via-amber-50 to-orange-50 shadow-sm"
      onClick={() => onOpenEdit(opportunity)}
    >
      <CardTitle className="border-b border-amber-100 bg-gradient-to-r from-amber-100 to-orange-100 p-2 text-sm">
        <div className="flex justify-between p-2">
          <span className="font-bold text-amber-950">{opportunity.name}</span>
          <div>
            {stage.probability !==
              Math.max(
                ...salesStages.map((s: any) => Number(s.probability || 0)),
              ) && <ThumbsDown className="w-4 h-4 text-rose-500" />}
          </div>
        </div>
      </CardTitle>
      <CardContent className="bg-white/70 text-xs text-slate-700">
        <div className="flex flex-col space-y-1">
          <div className="overflow-hidden rounded-md bg-amber-50 px-2 py-1 text-slate-700">
            <HoverCard>
              <HoverCardTrigger>
                {opportunity.description?.substring(0, 200)}
              </HoverCardTrigger>
              <HoverCardContent className="overflow-hidden">
                {opportunity.description}
              </HoverCardContent>
            </HoverCard>
          </div>
          <div className="space-x-1">
            <span className="font-medium text-amber-800">Amount:</span>
            <span className="font-semibold text-emerald-700">
              {formatCurrencyDisplay(
                opportunity.budget,
                (opportunity as any).currency || "USD",
              )}
            </span>
          </div>
          <div className="space-x-1">
            <span className="font-medium text-amber-800">
              Expected closing:
            </span>
            <span
              className={
                opportunity.close_date &&
                nowMs !== null &&
                new Date(opportunity.close_date).getTime() < nowMs
                  ? "font-semibold text-rose-500"
                  : "font-semibold text-violet-700"
              }
            >
              {opportunity.close_date
                ? format(new Date(opportunity.close_date), "dd/MM/yyyy")
                : "No close date"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-start justify-between gap-3 border-t border-amber-100 bg-gradient-to-r from-white to-amber-50">
        <div className="flex min-w-0 items-start gap-2">
          {/* <Avatar className="w-6 h-6">
            <AvatarImage
              src={
                opportunity.assigned_to_user?.avatar
                  ? opportunity.assigned_to_user.avatar
                  : "/images/nouser.png"
              }
          />
          </Avatar> */}
          <div className="flex min-w-0 flex-col">
            <span className="min-w-0 truncate text-sm font-medium text-slate-800">
              {getOpportunityClientName(opportunity) ||
                getOpportunityDisplayName(opportunity)}
            </span>
            {opportunityProducts.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {opportunityProducts.map((product) => (
                  <Badge
                    key={product}
                    variant="secondary"
                    className="w-fit shrink-0 whitespace-nowrap border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                  >
                    {product}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// Droppable zone inside each column — same pattern as DroppableColumn in Kanban.tsx
function DroppableStage({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-h-[50px]">
      {children}
    </div>
  );
}

const CRMKanban = ({
  salesStages,
  opportunities: data,
  crmData,
}: CRMKanbanProps) => {
  const router = useRouter();

  const [selectedStage, setSelectedStage] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customProducts, setCustomProducts] = useState<string[]>([]);
  const categoryList = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(
              (crmData?.products as
                | Array<{ name: string; status: string }>
                | undefined) ?? []
            )
              .filter((product) => product.status === "ACTIVE")
              .map((product) => product.name.trim()),
            ...customProducts,
          ].filter(Boolean),
        ),
      ),
    [crmData, customProducts],
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRetellDialogOpen, setIsRetellDialogOpen] = useState(false);
  const [outboundAgent, setOutboundAgent] = useState<RetellAgentOption | null>(
    null,
  );
  const [aiMessageOpportunity, setAiMessageOpportunity] =
    useState<crm_Opportunities | null>(null);
  const [aiMessageText, setAiMessageText] = useState("");
  const [isSendingAiMessage, setIsSendingAiMessage] = useState(false);
  const [opportunityCallStates, setOpportunityCallStates] = useState<
    Record<string, OpportunityPhoneCallState>
  >({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] =
    useState<crm_Opportunities | null>(null);
  const isHydrated = useHydrated();
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadOutboundAgent() {
      try {
        const response = await fetch("/api/retell/agents", {
          cache: "no-store",
        });
        const payload = (await response.json()) as RetellAgentsResponse;

        if (!response.ok || !("agents" in payload)) {
          return;
        }

        const agent =
          payload.agents.find((item) => item.isPublished) ?? payload.agents[0];
        if (isCurrent && agent) {
          setOutboundAgent(agent);
        }
      } catch (error) {
        console.error("[RETELL_OUTBOUND_AGENT_LOAD]", error);
      }
    }

    loadOutboundAgent();

    return () => {
      isCurrent = false;
    };
  }, []);

  const serverDataRef = useRef(data);
  const [columns, setColumns] = useState<Column[]>(() =>
    initColumns(data, salesStages, selectedCategories),
  );
  const [lostCards, setLostCards] = useState<crm_Opportunities[]>(() =>
    getLostOpportunities(data, selectedCategories),
  );
  const columnsRef = useRef<Column[]>(columns);

  const [activeOpportunity, setActiveOpportunity] =
    useState<crm_Opportunities | null>(null);
  const origStageIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  const {
    accounts,
    contacts,
    saleTypes,
    saleStages,
    campaigns,
    currencies,
    lostStage,
  } = crmData;

  const openEditOpportunity = (opportunity: crm_Opportunities) => {
    setEditingOpportunity(opportunity);
    setIsEditOpen(true);
  };

  const openAiMessageDialog = (opportunity: crm_Opportunities) => {
    setAiMessageOpportunity(opportunity);
    setAiMessageText("");
  };

  const closeAiMessageDialog = (open: boolean) => {
    if (!open && !isSendingAiMessage) {
      setAiMessageOpportunity(null);
      setAiMessageText("");
    }
  };

  const handleAddProduct = async (product: string) => {
    const normalizedProduct = product.trim();
    if (!normalizedProduct) {
      return false;
    }

    const existingProduct = categoryList.find(
      (item) => item.toLowerCase() === normalizedProduct.toLowerCase(),
    );

    if (existingProduct) {
      setSelectedCategories((current) =>
        current.includes(existingProduct)
          ? current
          : [...current, existingProduct],
      );
      return true;
    }

    const fallbackCurrency = currencies?.[0]?.code;
    if (!fallbackCurrency) {
      toast.error(
        "No active currency found. Add a currency before creating products.",
      );
      return false;
    }

    const result = await createProduct({
      name: normalizedProduct,
      type: "PRODUCT",
      status: "ACTIVE",
      unit_price: "0",
      currency: fallbackCurrency,
      is_recurring: false,
    });

    if (result?.error) {
      toast.error(result.error);
      return false;
    }

    if (result?.fieldErrors) {
      toast.error("Product could not be created");
      return false;
    }

    setCustomProducts((currentProducts) =>
      currentProducts.includes(normalizedProduct)
        ? currentProducts
        : [...currentProducts, normalizedProduct],
    );
    setSelectedCategories((current) =>
      current.includes(normalizedProduct)
        ? current
        : [...current, normalizedProduct],
    );
    toast.success("Product created successfully");
    router.refresh();
    return true;
  };

  // Sync from server (e.g. after onThumbsDown router.refresh()) — only when not dragging
  const handleStartPhoneCall = async (opportunity: crm_Opportunities) => {
    const target = getOpportunityCallTarget(opportunity);

    if (!target.phone) {
      setOpportunityCallStates((current) => ({
        ...current,
        [opportunity.id]: {
          status: "failed",
          error: "No phone number on linked member",
        },
      }));
      toast.error("No phone number found for this opportunity member");
      return;
    }

    const currentStatus = opportunityCallStates[opportunity.id]?.status;
    if (currentStatus === "calling" || currentStatus === "active") {
      return;
    }

    setOpportunityCallStates((current) => ({
      ...current,
      [opportunity.id]: { status: "calling" },
    }));

    try {
      const response = await fetch("/api/retell/create-phone-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          memberId: target.memberId,
          memberName: target.memberName,
          phone: target.phone,
          email: target.email,
          state: target.state,
          agentId: outboundAgent?.id,
          agentVersion: outboundAgent?.version,
        }),
      });
      const payload = (await response.json()) as any;

      if (!response.ok || !("success" in payload)) {
        const message =
          "error" in payload ? payload.error : "Outbound call failed";
        throw new Error(message ?? "Outbound call failed");
      }

      setOpportunityCallStates((current) => ({
        ...current,
        [opportunity.id]: {
          status: "active",
          callId: payload.callId,
        },
      }));
      toast.success(`Outbound AI call started for ${target.memberName}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Outbound call failed";
      setOpportunityCallStates((current) => ({
        ...current,
        [opportunity.id]: {
          status: "failed",
          error: message,
        },
      }));
      toast.error(message);
    }
  };

  const handleSendAiMessage = async () => {
    if (!aiMessageOpportunity) {
      return;
    }

    const target = getOpportunityCallTarget(aiMessageOpportunity);
    const message = aiMessageText.trim();

    if (!target.phone) {
      toast.error("No phone number found for this opportunity member");
      return;
    }

    if (!message) {
      toast.error("Message is required");
      return;
    }

    setIsSendingAiMessage(true);

    try {
      const result = await sendSMS({
        to: target.phone,
        message,
        opportunityId: aiMessageOpportunity.id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success(`SMS message sent to ${target.memberName}`);
      setAiMessageOpportunity(null);
      setAiMessageText("");
      router.refresh();
    } catch (error) {
      const responseMessage =
        error instanceof Error ? error.message : "SMS message failed";
      toast.error(responseMessage);
    } finally {
      setIsSendingAiMessage(false);
    }
  };

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    if (serverDataRef.current !== data && !isDraggingRef.current) {
      serverDataRef.current = data;
      setColumns(initColumns(data, salesStages, selectedCategories));
      setLostCards(getLostOpportunities(data, selectedCategories));
    }
  }, [data, salesStages, selectedCategories]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      const nextColumns = initColumns(data, salesStages, selectedCategories);
      columnsRef.current = nextColumns;
      setColumns(nextColumns);
      setLostCards(getLostOpportunities(data, selectedCategories));
    }
  }, [data, salesStages, selectedCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    const { active } = event;
    const activeId = active.id as string;
    for (const col of columnsRef.current) {
      const opp = col.opportunities.find((o) => o.id === activeId);
      if (opp) {
        setActiveOpportunity(opp);
        origStageIdRef.current = col.id;
        break;
      }
    }

    if (!origStageIdRef.current) {
      const lostOpp = lostCards.find((o) => o.id === activeId);
      if (lostOpp) {
        setActiveOpportunity(lostOpp);
        origStageIdRef.current = LOST_DROP_ID;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;
    if (overId === LOST_DROP_ID) return;

    const current = columnsRef.current;

    // Find source column and opportunity index
    let fromColIdx = -1,
      fromOppIdx = -1;
    for (let i = 0; i < current.length; i++) {
      const idx = current[i].opportunities.findIndex((o) => o.id === activeId);
      if (idx !== -1) {
        fromColIdx = i;
        fromOppIdx = idx;
        break;
      }
    }

    const fromLostIdx = lostCards.findIndex((o) => o.id === activeId);
    const fromLost = fromColIdx === -1 && fromLostIdx !== -1;
    if (fromColIdx === -1 && !fromLost) return;

    // Determine destination — overId is either a stage ID or an opportunity ID
    let toColIdx = current.findIndex((c) => c.id === overId);
    let toOppIdx = 0;
    const isOverColumn = toColIdx !== -1;

    if (!isOverColumn) {
      for (let i = 0; i < current.length; i++) {
        const idx = current[i].opportunities.findIndex((o) => o.id === overId);
        if (idx !== -1) {
          toColIdx = i;
          toOppIdx = idx;
          break;
        }
      }
    } else {
      toOppIdx = current[toColIdx].opportunities.length;
    }

    if (toColIdx === -1) return;
    if (fromColIdx === toColIdx) return;

    const newColumns = current.map((c) => ({
      ...c,
      opportunities: [...c.opportunities],
    }));
    let movedOpp: crm_Opportunities;
    if (fromLost) {
      movedOpp = {
        ...lostCards[fromLostIdx],
        status: "ACTIVE",
        sales_stage: newColumns[toColIdx].id,
      } as crm_Opportunities;
      const nextLost = [...lostCards];
      nextLost.splice(fromLostIdx, 1);
      setLostCards(nextLost);
    } else {
      [movedOpp] = newColumns[fromColIdx].opportunities.splice(fromOppIdx, 1);
      (movedOpp as any).sales_stage = newColumns[toColIdx].id;
      (movedOpp as any).status = "ACTIVE";
    }
    newColumns[toColIdx].opportunities.splice(toOppIdx, 0, movedOpp);
    columnsRef.current = newColumns;
    setColumns(newColumns);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    isDraggingRef.current = false;
    const { active, over } = event;
    setActiveOpportunity(null);

    const activeId = active.id as string;
    const overId = over?.id as string | undefined;
    const current = columnsRef.current;

    if (overId === LOST_DROP_ID) {
      try {
        await setInactiveOpportunity(activeId);
        toast.success("Opportunity has been set to inactive");
      } catch (error) {
        console.log(error);
        toast.error("Something went wrong");
      } finally {
        router.refresh();
      }
      return;
    }

    // Find where the opportunity ended up after handleDragOver moves
    let curColIdx = -1;
    for (let i = 0; i < current.length; i++) {
      if (current[i].opportunities.find((o) => o.id === activeId)) {
        curColIdx = i;
        break;
      }
    }
    if (curColIdx === -1) return;

    const curStageId = current[curColIdx].id;
    const wasCrossStageMove =
      origStageIdRef.current !== null && origStageIdRef.current !== curStageId;

    if (!wasCrossStageMove) return;

    try {
      const result = await updateOpportunity({
        id: activeId,
        sales_stage: curStageId,
      });
      if (result?.error) {
        toast.error(result.error);
        columnsRef.current = initColumns(data, salesStages, selectedCategories);
        setColumns(initColumns(data, salesStages, selectedCategories));
        setLostCards(getLostOpportunities(data, selectedCategories));
      } else {
        toast.success("Opportunity stage changed");
      }
    } catch (error) {
      console.log(error);
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
      columnsRef.current = initColumns(data, salesStages, selectedCategories);
      setColumns(initColumns(data, salesStages, selectedCategories));
      setLostCards(getLostOpportunities(data, selectedCategories));
    }
  };

  const onThumbsDown = async (opportunityId: string) => {
    try {
      await setInactiveOpportunity(opportunityId);
      toast.success("Opportunity has been set to inactive");
    } catch (error) {
      console.log(error);
    } finally {
      router.refresh();
    }
  };

  // Lost opportunities come from server data (updated via router.refresh on thumbsDown)
  const lostOpportunities = lostCards;

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2">
        <CategoryFilter
          categories={categoryList}
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
          onAddCategory={handleAddProduct}
          allowCreate
        />
        <ImportOpportunitiesDialog />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={() => setIsDialogOpen(false)}>
        <DialogContent className="min-w-[1000px] py-10 overflow-auto">
          <DialogTitle className="sr-only">Create opportunity</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new opportunity in the selected sales stage.
          </DialogDescription>
          <NewOpportunityForm
            accounts={accounts}
            contacts={contacts}
            salesType={saleTypes}
            saleStages={saleStages}
            campaigns={campaigns}
            currencies={(currencies ?? []).map((c: any) => ({
              code: c.code,
              name: c.name,
              symbol: c.symbol,
            }))}
            categoryOptions={categoryList}
            selectedCategories={selectedCategories}
            selectedStage={selectedStage}
            onDialogClose={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <RetellAssistantDialog
        open={isRetellDialogOpen}
        onOpenChange={setIsRetellDialogOpen}
        onAgentSelect={setOutboundAgent}
        currentAgentId={outboundAgent?.id}
      />

      <OpportunityAiMessageDialog
        open={Boolean(aiMessageOpportunity)}
        onOpenChange={closeAiMessageDialog}
        opportunity={aiMessageOpportunity}
        
        message={aiMessageText}
        onMessageChange={setAiMessageText}
        onSend={handleSendAiMessage}
        isSending={isSendingAiMessage}
      />

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent
          className="w-full md:max-w-[771px] overflow-y-auto"
          onClick={stopRowNavigation}
          onKeyDown={stopRowNavigation}
        >
          <SheetHeader>
            <SheetTitle>
              Update Opportunity
              {editingOpportunity?.name ? ` - ${editingOpportunity.name}` : ""}
            </SheetTitle>
            <SheetDescription>Update opportunity details</SheetDescription>
          </SheetHeader>
          {editingOpportunity ? (
            <div className="mt-6 space-y-4">
              <UpdateOpportunityForm
                initialData={editingOpportunity}
                setOpen={setIsEditOpen}
                saleTypes={saleTypes}
                saleStages={saleStages}
                campaigns={campaigns}
                contacts={contacts}
                currencies={(currencies ?? []).map((c: any) => ({
                  code: c.code,
                  name: c.name,
                  symbol: c.symbol,
                }))}
                categoryOptions={categoryList}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {!isHydrated ? (
        <div className="flex w-full h-full overflow-x-auto h-[500px] gap-4 px-2 pb-2">
          {columns.map((col) => (
            <Card
              key={col.id}
              className="flex flex-col w-full min-w-[300px] max-w-[320px] bg-background border rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Header */}
              <CardTitle className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold text-foreground">
                  {col.name}
                </span>

                <PlusCircledIcon
                  className="w-5 h-5 cursor-pointer text-muted-foreground hover:text-primary transition"
                  onClick={() => {
                    setSelectedStage(col.id);
                    setIsDialogOpen(true);
                  }}
                />
              </CardTitle>

              {/* Content */}
              <CardContent className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                <StageStats opportunities={col.opportunities} />
                <div className="min-h-[50px] space-y-2">
                  {col.opportunities.map((opportunity) => (
                    <OpportunityCardStatic
                      key={opportunity.id}
                      opportunity={opportunity}
                      onOpenEdit={openEditOpportunity}
                      stage={col}
                      salesStages={salesStages}
                      nowMs={nowMs}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Lost Column */}
          <Card className="flex flex-col w-full min-w-[300px] max-w-[320px] bg-background border rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
            <CardTitle className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold text-red-500">
                {lostStage?.name ?? "Lost"}
              </span>
            </CardTitle>

            <CardContent className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              <StageStats opportunities={lostOpportunities} />
              <div className="min-h-[50px] space-y-2">
                {lostOpportunities.map((opportunity: any) => (
                  <OpportunityCardStatic
                    key={opportunity.id}
                    opportunity={opportunity}
                    onOpenEdit={openEditOpportunity}
                    stage={{ probability: null }}
                    salesStages={salesStages}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <DndContext
          id="crm-dashboard-kanban"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex w-full h-full overflow-x-auto">
            {columns.map((col) => (
              <Card
                key={col.id}
                className="mx-1 w-full min-w-[300px] overflow-hidden pb-10"
              >
                <CardTitle className="flex gap-2 p-3 justify-between">
                  <span className="text-sm  font-bold">{col.name}</span>
                  <div className="flex">
                    <button
                      type="button"
                      className="mr-[10px] inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Open voice AI retail assistant"
                      onClick={() => setIsRetellDialogOpen(true)}
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    <PlusCircledIcon
                      className="w-5 h-5 cursor-pointer"
                      onClick={() => {
                        setSelectedStage(col.id);
                        setIsDialogOpen(true);
                      }}
                    />{" "}
                  </div>
                </CardTitle>
                <CardContent className="w-full h-full overflow-y-auto">
                  <StageStats opportunities={col.opportunities} />
                  <SortableContext
                    items={col.opportunities.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableStage id={col.id}>
                      {col.opportunities.map((opportunity) => (
                        <OpportunityCard
                          key={opportunity.id}
                          opportunity={opportunity}
                          onThumbsDown={onThumbsDown}
                          onOpenEdit={openEditOpportunity}
                          onOpenAiMessage={openAiMessageDialog}
                          stage={col}
                          salesStages={salesStages}
                          nowMs={nowMs}
                          phoneCallState={opportunityCallStates[opportunity.id]}
                          onStartPhoneCall={handleStartPhoneCall}
                        />
                      ))}
                    </DroppableStage>
                  </SortableContext>
                </CardContent>
              </Card>
            ))}

            {/* Lost Opportunities Column */}
            <Card className="mx-1 w-full min-w-[300px] overflow-hidden pb-10">
              <CardTitle className="flex gap-2 p-3 justify-between">
                <span className="text-sm font-bold">
                  {lostStage?.name ?? "Lost"}
                </span>
              </CardTitle>
              <CardContent className="w-full h-full overflow-y-scroll space-y-2">
                <StageStats opportunities={lostOpportunities} />
                <DroppableStage id={LOST_DROP_ID}>
                  <SortableContext
                    items={lostOpportunities.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {lostOpportunities.map((opportunity: any) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        onThumbsDown={onThumbsDown}
                        onOpenEdit={openEditOpportunity}
                        onOpenAiMessage={openAiMessageDialog}
                        stage={{ probability: null }}
                        salesStages={salesStages}
                        nowMs={nowMs}
                        phoneCallState={opportunityCallStates[opportunity.id]}
                        onStartPhoneCall={handleStartPhoneCall}
                      />
                    ))}
                  </SortableContext>
                </DroppableStage>
              </CardContent>
            </Card>
          </div>

          <DragOverlay>
            {activeOpportunity ? (
              <Card className="my-2 w-[280px] opacity-80 bg-white shadow-lg">
                <CardTitle className="p-2 text-sm">
                  <div className="flex justify-between p-2">
                    <span className="font-bold">{activeOpportunity.name}</span>
                  </div>
                </CardTitle>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
};

export default CRMKanban;
