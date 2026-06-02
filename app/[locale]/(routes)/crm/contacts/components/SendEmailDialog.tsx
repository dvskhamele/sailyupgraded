"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isAllowedSmtp2GoSender,
  SMTP2GO_SENDER_DOMAIN_ERROR,
} from "@/lib/email/sender-policy";

type SendEmailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: string[];
  defaultFrom?: string;
  onSent?: () => void;
};

type SendEmailResponse = {
  sent: number;
  failed: number;
  error?: string;
  failures?: {
    recipient: string;
    error?: string;
    status?: number;
  }[];
};

export function SendEmailDialog({
  open,
  onOpenChange,
  recipients,
  defaultFrom = "",
  onSent,
}: SendEmailDialogProps) {
  const [from, setFrom] = React.useState(defaultFrom);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  const uniqueRecipients = React.useMemo(
    () => Array.from(new Set(recipients.filter(Boolean))),
    [recipients]
  );

  React.useEffect(() => {
    if (open) {
      setFrom(defaultFrom);
    }
  }, [defaultFrom, open]);

  const recipientPreview = uniqueRecipients.slice(0, 5).join(", ");
  const hiddenRecipientCount = Math.max(uniqueRecipients.length - 5, 0);

  const handleSend = async () => {
    if (uniqueRecipients.length === 0) {
      toast.error("Select at least one contact with an email address.");
      return;
    }
    if (!from.trim()) {
      toast.error("From cannot be empty.");
      return;
    }
    if (!isAllowedSmtp2GoSender(from)) {
      toast.error(SMTP2GO_SENDER_DOMAIN_ERROR);
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject cannot be empty.");
      return;
    }
    if (!message.trim()) {
      toast.error("Message cannot be empty.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          recipients: uniqueRecipients,
          subject,
          message,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as SendEmailResponse;
      const firstFailure = result.failures?.[0];
      const failureMessage = firstFailure
        ? `${firstFailure.recipient}: ${firstFailure.error ?? `SMTP2GO status ${firstFailure.status}`}`
        : undefined;

      if (!response.ok) {
        toast.error(failureMessage ?? result.error ?? "Failed to send email.");
        return;
      }

      if (result.failed > 0) {
        toast.error(
          failureMessage ?? `${result.failed} email(s) failed to send.`
        );
      } else {
        toast.success("Email sent successfully.");
      }

      if (result.sent > 0) {
        setSubject("");
        setMessage("");
        onSent?.();
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to send email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSending && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Send an individual email to each selected contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-email-from">From</Label>
            <Input
              id="bulk-email-from"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              placeholder="support@example.com"
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-email-to">To</Label>
            <Textarea
              id="bulk-email-to"
              value={`${uniqueRecipients.length} recipient(s)${
                recipientPreview
                  ? `\n${recipientPreview}${hiddenRecipientCount ? `, +${hiddenRecipientCount} more` : ""}`
                  : ""
              }`}
              readOnly
              className="min-h-[88px] resize-none text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-email-subject">Subject</Label>
            <Input
              id="bulk-email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-email-message">Message Body</Label>
            <Textarea
              id="bulk-email-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[220px]"
              disabled={isSending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || uniqueRecipients.length === 0}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
