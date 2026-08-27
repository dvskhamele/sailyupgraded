"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Phone,
  Users,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  buildWhatsAppWebExtensionUrl,
  processContactsForWhatsApp,
  type ContactPhoneSource,
} from "@/lib/whatsapp-extension";

export interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactPhoneSource[];
  entityType?: "contact" | "lead" | "person" | "people";
  onSent?: () => void;
}

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  contacts,
  entityType = "contact",
  onSent,
}: SendWhatsAppDialogProps) {
  const [message, setMessage] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const isLead = entityType === "lead";
  const isPeople = entityType === "people" || entityType === "person";
  const entitySingular = isLead ? "lead" : isPeople ? "person" : "contact";
  const entityPlural = isLead ? "leads" : isPeople ? "people" : "contacts";
  const EntitySingularCap = isLead ? "Lead" : isPeople ? "Person" : "Contact";
  const EntityPluralCap = isLead ? "Leads" : isPeople ? "People" : "Contacts";

  const { validRecipients, skippedContacts, uniquePhoneNumbers, extPhoneParam } =
    React.useMemo(() => {
      return processContactsForWhatsApp(contacts);
    }, [contacts]);

  const selectedTotal = contacts.length;
  const validCount = validRecipients.length;
  const skippedCount = skippedContacts.length;

  // Reset state when opening/closing
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage("");
      setErrorMessage(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSend = () => {
    if (validCount === 0) {
      toast.error(
        `No selected ${EntityPluralCap} have a valid phone number.`
      );
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      const error = "Please enter a message.";
      setErrorMessage(error);
      toast.error(error);
      return;
    }

    // Build extension URL safely
    const url = buildWhatsAppWebExtensionUrl(uniquePhoneNumbers, trimmedMessage);

    // Open WhatsApp Web in a new tab for the browser extension
    window.open(url, "_blank", "noopener,noreferrer");

    toast.success(
      `Opening WhatsApp Web for ${validCount} ${validCount === 1 ? entitySingular : entityPlural}...`
    );

    // Clean up modal state and clear row selection
    setMessage("");
    setErrorMessage(null);
    onSent?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
            Send WhatsApp
          </DialogTitle>
          <DialogDescription>
            Compose a message to broadcast to selected {entityPlural} using the WhatsApp browser extension.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Recipients Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Recipients ({validCount})
              </Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-normal">
                  Selected: {selectedTotal}
                </Badge>
                {validCount > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800">
                    {validCount} ready
                  </Badge>
                )}
              </div>
            </div>

            {/* Validation warning when some contacts/leads/people are skipped */}
            {skippedCount > 0 && (
              <div
                className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-md border border-amber-200 dark:border-amber-900"
                data-testid="whatsapp-skipped-notice"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {validCount} {validCount === 1 ? "recipient" : "recipients"} will receive the WhatsApp message.
                  </p>
                  <p className="text-muted-foreground">
                    {isPeople
                      ? `${skippedCount} selected People don't have a valid phone number and will be skipped.`
                      : isLead
                      ? `${skippedCount} ${skippedCount === 1 ? "Lead doesn't" : "Leads don't"} have a valid phone number and will be skipped.`
                      : `${skippedCount} selected ${skippedCount === 1 ? "contact has" : "contacts have"} no valid phone number and will be skipped.`}
                  </p>
                </div>
              </div>
            )}

            {/* Recipients List */}
            {validCount > 0 ? (
              <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-md border bg-muted/20 p-2.5">
                {validRecipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between gap-3 text-xs py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium truncate text-foreground">
                        {recipient.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground font-mono">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{recipient.rawPhone}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive text-center">
                No selected {EntityPluralCap} have a valid phone number.
              </div>
            )}
          </div>

          {/* Message Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="whatsapp-message-input"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Message
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {message.length} character{message.length === 1 ? "" : "s"}
              </span>
            </div>
            <Textarea
              id="whatsapp-message-input"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errorMessage && e.target.value.trim()) {
                  setErrorMessage(null);
                }
              }}
              placeholder="Write your WhatsApp message..."
              className={`min-h-[120px] text-sm resize-y ${
                errorMessage ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
              data-testid="whatsapp-message-textarea"
            />
            {errorMessage && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMessage}
              </p>
            )}
          </div>

          {/* Message Preview Section (Section 10) */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span>Message Preview</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Recipients: </span>
                {validCount} {validCount === 1 ? entitySingular : entityPlural}
              </div>
              <div>
                <span className="font-medium text-foreground">Numbers: </span>
                <span className="font-mono break-all">
                  {extPhoneParam || "None"}
                </span>
              </div>
              <div>
                <span className="font-medium text-foreground">Message: </span>
                <span className="text-foreground italic">
                  {message.trim() || "(No message written yet)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0 flex-row justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={validCount === 0}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            data-testid="whatsapp-send-btn"
          >
            <ExternalLink className="h-4 w-4" />
            Send WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
