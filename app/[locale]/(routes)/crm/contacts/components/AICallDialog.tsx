"use client";

import * as React from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  FileText,
  Headphones,
  Loader2,
  Phone,
  PhoneCall,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cleanWhatsAppPhoneNumber,
  getContactDisplayName,
  getContactRawPhone,
  type ContactPhoneSource,
} from "@/lib/whatsapp-extension";
import { normalizeE164PhoneNumber, isE164PhoneNumber } from "@/lib/retell-client";
import {
  bulkAICallContacts,
  type BulkAICallResponse,
} from "@/actions/crm/calls/bulk-ai-call";

export interface AICallingAgentOption {
  id: string;
  name: string;
  version?: number;
  isPublished?: boolean;
}

export interface AICallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactPhoneSource[];
  entityType?: "contact" | "lead" | "person" | "people" | "record";
  onCallsStarted?: (result: BulkAICallResponse) => void;
}

const COMMON_CALL_PURPOSES = [
  "Lead Qualification",
  "Appointment Booking",
  "Follow-up on Proposal",
  "Product Demo Invitation",
  "Customer Satisfaction Survey",
  "Re-engagement Campaign",
];

export function AICallDialog({
  open,
  onOpenChange,
  contacts,
  entityType = "contact",
  onCallsStarted,
}: AICallDialogProps) {
  const [agents, setAgents] = React.useState<AICallingAgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [agentScript, setAgentScript] = React.useState<string>("");
  const [loadingScript, setLoadingScript] = React.useState<boolean>(false);
  const [callPurpose, setCallPurpose] = React.useState<string>("");
  const [customPurpose, setCustomPurpose] = React.useState<string>("");
  const [agentsLoading, setAgentsLoading] = React.useState<boolean>(false);
  const [agentsError, setAgentsError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  const entitySingular =
    entityType === "lead"
      ? "lead"
      : entityType === "person" || entityType === "people"
        ? "person"
        : "contact";

  const entityPlural =
    entityType === "lead"
      ? "leads"
      : entityType === "person" || entityType === "people"
        ? "people"
        : "contacts";

  // Load configured AI Calling Agents dynamically from the CRM backend when dialog opens
  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const loadAgents = async () => {
      setAgentsLoading(true);
      setAgentsError(null);
      try {
        const res = await fetch("/api/retell/agents", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch configured AI calling agents");
        }
        const data = await res.json();
        if (isMounted) {
          const list: AICallingAgentOption[] = data.agents || [];
          setAgents(list);

          // DO NOT auto-select an agent. Require explicit user selection.
          if (list.length === 0 && data.error) {
            setAgentsError(data.error);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setAgentsError(
            err?.message || "Could not load AI agents. Please check AI calling configuration in Settings."
          );
        }
      } finally {
        if (isMounted) {
          setAgentsLoading(false);
        }
      }
    };

    loadAgents();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Load selected agent script/prompt preview when an agent is chosen
  React.useEffect(() => {
    if (!open || !selectedAgentId) {
      setAgentScript("");
      return;
    }

    let isMounted = true;
    const loadScript = async () => {
      setLoadingScript(true);
      try {
        const res = await fetch(
          `/api/retell/agents/${encodeURIComponent(selectedAgentId)}/script`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.script) {
            setAgentScript(data.script);
          }
        }
      } catch (err) {
        console.warn("[AI_CALL_DIALOG] Could not load agent script preview:", err);
      } finally {
        if (isMounted) {
          setLoadingScript(false);
        }
      }
    };

    loadScript();

    return () => {
      isMounted = false;
    };
  }, [open, selectedAgentId]);

  // Extract valid and skipped contacts
  const { readyContacts, skippedContacts } = React.useMemo(() => {
    const ready: Array<{
      id: string;
      name: string;
      rawPhone: string;
      normalizedPhone: string;
      email?: string;
      state?: string;
      company?: string;
      contact: ContactPhoneSource;
    }> = [];

    const skipped: Array<{
      id: string;
      name: string;
      reason: string;
      contact: ContactPhoneSource;
    }> = [];

    for (const contact of contacts) {
      const name = getContactDisplayName(contact);
      const id = contact.id || name;
      const rawPhone = getContactRawPhone(contact);
      const cleanPhone = cleanWhatsAppPhoneNumber(rawPhone);
      const normalizedPhone = normalizeE164PhoneNumber(rawPhone || "");

      if (!rawPhone || !cleanPhone || !isE164PhoneNumber(normalizedPhone)) {
        skipped.push({
          id,
          name,
          reason: "No valid phone number with country code",
          contact,
        });
      } else {
        ready.push({
          id,
          name,
          rawPhone,
          normalizedPhone,
          email: contact.email || contact.personal_email || undefined,
          state: contact.state || undefined,
          company: contact.company || undefined,
          contact,
        });
      }
    }

    return { readyContacts: ready, skippedContacts: skipped };
  }, [contacts]);

  const selectedTotal = contacts.length;
  const readyCount = readyContacts.length;
  const skippedCount = skippedContacts.length;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedAgentId("");
      setAgentScript("");
      setCallPurpose("");
      setCustomPurpose("");
    }
    onOpenChange(nextOpen);
  };

  const handleStartCalls = async () => {
    if (readyCount === 0) {
      toast.error(`No selected ${entityPlural} have a valid phone number.`);
      return;
    }

    if (!selectedAgentId) {
      toast.error("Please select an AI Calling Agent before starting calls.");
      return;
    }

    const selectedAgent = agents.find((a) => a.id === selectedAgentId);
    const finalPurpose =
      callPurpose === "custom"
        ? customPurpose.trim()
        : callPurpose && callPurpose !== "none"
          ? callPurpose
          : undefined;

    setSubmitting(true);

    try {
      const response = await bulkAICallContacts({
        agentId: selectedAgentId,
        agentVersion: selectedAgent?.version,
        callPurpose: finalPurpose,
        contacts: readyContacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.normalizedPhone,
          email: c.email,
          state: c.state,
          company: c.company,
        })),
      });

      if (!response.success && response.queued === 0) {
        toast.error(
          response.error || "Failed to start AI calls with voice provider."
        );
        return;
      }

      if (response.failed > 0 && response.queued > 0) {
        toast.warning(
          `AI Calls Started: ${response.queued} queued, ${response.failed} failed.`
        );
      } else {
        toast.success(
          `AI Calls Started: ${response.queued} ${
            response.queued === 1 ? entitySingular : entityPlural
          } successfully queued.`
        );
      }

      onCallsStarted?.(response);
      handleOpenChange(false);
    } catch (err: any) {
      console.error("[AI_CALL_MODAL_ERROR]", err);
      toast.error(err?.message || "An unexpected error occurred while starting AI calls.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            AI Call
          </DialogTitle>
          <DialogDescription>
            Initiate automated AI voice calls to selected {entityPlural} using your configured AI calling agent.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Selected Contacts Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Selected {entityPlural.charAt(0).toUpperCase() + entityPlural.slice(1)} ({readyCount})
              </Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-normal">
                  Selected: {selectedTotal}
                </Badge>
                {readyCount > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800">
                    {readyCount} ready
                  </Badge>
                )}
              </div>
            </div>

            {/* Validation Notice when some contacts are skipped */}
            {skippedCount > 0 && (
              <div
                className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-md border border-amber-200 dark:border-amber-900"
                data-testid="ai-call-skipped-notice"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {readyCount} {readyCount === 1 ? entitySingular : entityPlural} ready for AI calling.
                  </p>
                  <p className="text-muted-foreground">
                    {skippedCount} {skippedCount === 1 ? entitySingular : entityPlural} will be skipped because no valid phone number exists.
                  </p>
                </div>
              </div>
            )}

            {/* Ready Contacts List */}
            {readyCount > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-md border bg-muted/20 p-2.5">
                {readyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 text-xs py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium truncate text-foreground">
                        {contact.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground font-mono">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{contact.normalizedPhone}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive text-center">
                No selected {entityPlural} have a valid phone number.
              </div>
            )}
          </div>

          {/* AI Voice Agent Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="ai-agent-select"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
              >
                <Headphones className="h-3.5 w-3.5" />
                AI Agent
              </Label>
              {selectedAgent && (
                <Badge variant="outline" className="text-[11px] font-normal">
                  {selectedAgent.version !== undefined ? `v${selectedAgent.version}` : "Configured"}
                </Badge>
              )}
            </div>

            {agentsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading configured AI calling agents...
              </div>
            ) : agentsError ? (
              <div className="text-xs text-destructive p-2.5 border border-destructive/30 rounded-md bg-destructive/10 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{agentsError}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Please configure your AI voice calling integration in Settings → Integrations.
                  </p>
                </div>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-xs text-amber-700 dark:text-amber-400 p-2.5 border border-amber-200 dark:border-amber-900 rounded-md bg-amber-50 dark:bg-amber-950/40">
                No AI calling agents are configured.
              </div>
            ) : (
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                disabled={submitting}
              >
                <SelectTrigger id="ai-agent-select" className="w-full text-xs" data-testid="ai-agent-select-trigger">
                  <SelectValue placeholder="Select AI Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="text-xs">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span>{agent.name}</span>
                        {agent.isPublished && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50">
                            Published
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Script / Instructions Preview when an agent is selected */}
          {selectedAgentId && (
            <div className="space-y-1.5 rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Agent Instructions Preview
                </span>
                {loadingScript && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </div>
              <div className="max-h-28 overflow-y-auto whitespace-pre-wrap text-muted-foreground text-[11px] leading-relaxed pt-1">
                {loadingScript ? (
                  <span>Loading agent prompt instructions...</span>
                ) : agentScript ? (
                  agentScript
                ) : (
                  <span className="italic">Standard agent behavior configured for {selectedAgent?.name}.</span>
                )}
              </div>
            </div>
          )}

          {/* Call Purpose / Campaign Objective */}
          <div className="space-y-2">
            <Label
              htmlFor="call-purpose-select"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Call Purpose (Optional)
            </Label>
            <Select
              value={callPurpose}
              onValueChange={setCallPurpose}
              disabled={submitting}
            >
              <SelectTrigger id="call-purpose-select" className="w-full text-xs">
                <SelectValue placeholder="Select or enter call purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-muted-foreground">
                  Default Agent Behavior
                </SelectItem>
                {COMMON_CALL_PURPOSES.map((purpose) => (
                  <SelectItem key={purpose} value={purpose} className="text-xs">
                    {purpose}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs font-medium">
                  + Custom Purpose...
                </SelectItem>
              </SelectContent>
            </Select>

            {callPurpose === "custom" && (
              <Input
                placeholder="Enter custom call purpose or instructions..."
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                disabled={submitting}
                className="text-xs mt-1.5"
              />
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0 flex-row justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleStartCalls}
            disabled={readyCount === 0 || !selectedAgentId || agents.length === 0 || submitting || agentsLoading}
            className="gap-1.5 bg-primary text-primary-foreground"
            data-testid="start-ai-calls-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting AI Calls...
              </>
            ) : (
              <>
                <PhoneCall className="h-4 w-4" />
                Start AI Calls
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
