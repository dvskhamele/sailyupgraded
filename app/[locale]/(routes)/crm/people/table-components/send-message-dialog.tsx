"use client";

import * as React from "react";
import {
  Loader2,
  MessageSquare,
  Mail,
  Send,
  Phone,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Users,
  Eye,
  Info,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMessageConfig,
  type MessageTemplate,
  type MessagingChannelsConfig,
} from "@/actions/crm/messages/get-message-config";
import {
  sendBulkMessages,
  type BulkMessageRecipient,
} from "@/actions/crm/messages/send-bulk-messages";
import { resolveMergeTags } from "@/lib/campaigns/merge-tags";
import type { PeopleRecord } from "@/types/people";

export interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: (PeopleRecord | BulkMessageRecipient)[];
  defaultChannel?: "sms" | "email" | "whatsapp";
  defaultFromEmail?: string;
  onSent?: () => void;
}

const PERSONALIZATION_TAGS = [
  { label: "First Name", tag: "{{firstName}}" },
  { label: "Last Name", tag: "{{lastName}}" },
  { label: "Company", tag: "{{company}}" },
  { label: "Email", tag: "{{email}}" },
  { label: "Phone", tag: "{{phone}}" },
];

function cleanPhoneNumber(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === "unavailable" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "none"
  ) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 5) return null;
  return trimmed;
}

function cleanEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (
    !trimmed ||
    !trimmed.includes("@") ||
    trimmed === "unavailable" ||
    trimmed === "extrapolated" ||
    trimmed === "entry" ||
    trimmed === "null"
  ) {
    return null;
  }
  return trimmed;
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

export function SendMessageDialog({
  open,
  onOpenChange,
  recipients,
  defaultChannel = "sms",
  defaultFromEmail = "",
  onSent,
}: SendMessageDialogProps) {
  const [selectedChannel, setSelectedChannel] = React.useState<"sms" | "email" | "whatsapp">(defaultChannel);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);

  const [channelsConfig, setChannelsConfig] = React.useState<MessagingChannelsConfig>({
    sms: false,
    email: false,
    whatsapp: true,
  });
  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Load available channels & templates on modal open
  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoadingConfig(true);

    getMessageConfig()
      .then((res) => {
        if (!isMounted) return;
        setChannelsConfig(res.channels);
        setTemplates(res.templates);

        // If default channel is not configured, fall back to an available channel
        if (defaultChannel === "sms" && !res.channels.sms) {
          if (res.channels.email) {
            setSelectedChannel("email");
          } else if (res.channels.whatsapp) {
            setSelectedChannel("whatsapp");
          }
        } else if (defaultChannel === "email" && !res.channels.email) {
          if (res.channels.sms) {
            setSelectedChannel("sms");
          } else if (res.channels.whatsapp) {
            setSelectedChannel("whatsapp");
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load message config:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingConfig(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, defaultChannel]);

  // Transform PeopleRecord to BulkMessageRecipient
  const normalizedRecipients: BulkMessageRecipient[] = React.useMemo(() => {
    return recipients.map((r) => {
      const rec = r as PeopleRecord;
      const firstName =
        rec.firstName ||
        (rec.name ? rec.name.split(" ")[0] : undefined);
      const lastName =
        rec.lastName ||
        (rec.name && rec.name.split(" ").length > 1
          ? rec.name.split(" ").slice(1).join(" ")
          : undefined);

      return {
        id: rec.id,
        originalId: rec.originalId || rec.id,
        name: rec.fullName || rec.name || "Unknown",
        fullName: rec.fullName || rec.name || "Unknown",
        firstName,
        lastName,
        email: rec.email || rec.personalEmail,
        personalEmail: rec.personalEmail,
        phone: rec.phone || rec.mobilePhone || rec.officePhone,
        mobilePhone: rec.mobilePhone,
        officePhone: rec.officePhone,
        company: rec.company,
        jobTitle: rec.jobTitle || rec.role,
        type: rec.type,
      };
    });
  }, [recipients]);

  // Compute valid, deduplicated recipients based on selected channel
  const { validRecipients, skippedCount, duplicateCount } = React.useMemo(() => {
    const total = normalizedRecipients.length;
    if (selectedChannel === "sms" || selectedChannel === "whatsapp") {
      const seenPhones = new Set<string>();
      const valid: BulkMessageRecipient[] = [];
      let skipped = 0;
      let dupes = 0;

      for (const r of normalizedRecipients) {
        const phone = cleanPhoneNumber(r.phone);
        if (!phone) {
          skipped++;
          continue;
        }
        const key = phone.replace(/[\s\-\(\)\.]/g, "");
        if (seenPhones.has(key)) {
          dupes++;
          continue;
        }
        seenPhones.add(key);
        valid.push(r);
      }

      return {
        validRecipients: valid,
        skippedCount: skipped,
        duplicateCount: dupes,
      };
    } else {
      // Email
      const seenEmails = new Set<string>();
      const valid: BulkMessageRecipient[] = [];
      let skipped = 0;
      let dupes = 0;

      for (const r of normalizedRecipients) {
        const email = cleanEmail(r.email);
        if (!email) {
          skipped++;
          continue;
        }
        if (seenEmails.has(email)) {
          dupes++;
          continue;
        }
        seenEmails.add(email);
        valid.push(r);
      }

      return {
        validRecipients: valid,
        skippedCount: skipped,
        duplicateCount: dupes,
      };
    }
  }, [normalizedRecipients, selectedChannel]);

  // Insert personalization variable tag at cursor
  const handleInsertTag = (tag: string) => {
    if (!textareaRef.current) {
      setMessage((prev) => prev + tag);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = message;
    const updated = current.substring(0, start) + tag + current.substring(end);
    setMessage(updated);

    // Reposition cursor after tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    if (!templateId) return;
    const selected = templates.find((t) => t.id === templateId);
    if (selected) {
      if (selected.subject_default && !subject) {
        setSubject(selected.subject_default);
      }
      const plainText = stripHtml(selected.content_html);
      setMessage(plainText);
      toast.info(`Applied template: ${selected.name}`);
    }
  };

  // Sample recipient preview
  const sampleRecipient = validRecipients[0] || normalizedRecipients[0];
  const previewMessage = React.useMemo(() => {
    if (!sampleRecipient || !message) return "";
    return resolveMergeTags(message, {
      firstName: sampleRecipient.firstName || sampleRecipient.name?.split(" ")[0] || "Friend",
      first_name: sampleRecipient.firstName || sampleRecipient.name?.split(" ")[0] || "Friend",
      lastName: sampleRecipient.lastName || "",
      last_name: sampleRecipient.lastName || "",
      email: sampleRecipient.email || "recipient@example.com",
      company: sampleRecipient.company || "Your Company",
      phone: sampleRecipient.phone || "+1 555-0100",
      jobTitle: sampleRecipient.jobTitle || "Professional",
      position: sampleRecipient.jobTitle || "Professional",
      name: sampleRecipient.fullName || sampleRecipient.name || "Recipient",
      fullName: sampleRecipient.fullName || sampleRecipient.name || "Recipient",
    });
  }, [message, sampleRecipient]);

  // Send handler
  const handleSend = async () => {
    if (validRecipients.length === 0) {
      if (selectedChannel === "sms") {
        toast.error("None of the selected records have valid phone numbers.");
      } else {
        toast.error("None of the selected records have valid email addresses.");
      }
      return;
    }

    if (!message.trim()) {
      toast.error("Message body cannot be empty.");
      return;
    }

    if (selectedChannel === "email" && !subject.trim()) {
      toast.error("Subject is required for emails.");
      return;
    }

    // Special case for WhatsApp click-to-chat if sending single contact directly
    if (selectedChannel === "whatsapp" && validRecipients.length === 1) {
      const targetPhone = validRecipients[0].phone?.replace(/\D/g, "");
      const encodedMsg = encodeURIComponent(previewMessage || message);
      window.open(`https://wa.me/${targetPhone}?text=${encodedMsg}`, "_blank");
      toast.success(`Opening WhatsApp chat for ${validRecipients[0].name}`);
      onSent?.();
      onOpenChange(false);
      return;
    }

    setIsSending(true);
    try {
      const result = await sendBulkMessages({
        channel: selectedChannel,
        recipients: validRecipients,
        message,
        subject,
        fromEmail: defaultFromEmail,
      });

      if (!result.success) {
        // PRESERVE selection on failure (do NOT call onSent)
        toast.error(result.error || "Failed to send message(s). Please try again.");
        return;
      }

      // Success feedback
      const channelLabel =
        selectedChannel === "sms"
          ? "SMS message(s)"
          : selectedChannel === "email"
          ? "email(s)"
          : "WhatsApp message(s)";

      toast.success(
        `Successfully sent ${result.sentCount} ${channelLabel}!`
      );

      // Reset form and CLEAR selection on success
      setMessage("");
      setSubject("");
      onSent?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Bulk send error:", err);
      toast.error(err.message || "An unexpected error occurred while sending.");
    } finally {
      setIsSending(false);
    }
  };

  const smsLength = message.length;
  const smsSegments = Math.ceil(smsLength / 160) || 1;

  return (
    <Dialog open={open} onOpenChange={isSending ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send Message
          </DialogTitle>
          <DialogDescription>
            Compose and broadcast personalized messages to selected contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Channel Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Delivery Channel
              </Label>
              {channelsConfig.sms && selectedChannel === "sms" && (
                <Badge variant="outline" className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Twilio Connected
                </Badge>
              )}
            </div>

            <Tabs
              value={selectedChannel}
              onValueChange={(val) => setSelectedChannel(val as "sms" | "email" | "whatsapp")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="sms"
                  disabled={isSending || (!channelsConfig.sms && !isLoadingConfig)}
                  className="text-xs gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5" />
                  SMS {channelsConfig.sms ? "" : "(Not Configured)"}
                </TabsTrigger>
                <TabsTrigger
                  value="email"
                  disabled={isSending || (!channelsConfig.email && !isLoadingConfig)}
                  className="text-xs gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </TabsTrigger>
                <TabsTrigger
                  value="whatsapp"
                  disabled={isSending}
                  className="text-xs gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Recipients Summary Box */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium">
              <div className="flex items-center gap-1.5 text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>
                  <strong className="text-foreground font-semibold">{validRecipients.length}</strong> recipient(s) ready
                </span>
                {normalizedRecipients.length > validRecipients.length && (
                  <span className="text-muted-foreground font-normal">
                    (from {normalizedRecipients.length} selected)
                  </span>
                )}
              </div>

              {duplicateCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {duplicateCount} duplicate(s) removed
                </Badge>
              )}
            </div>

            {/* Validation warnings for missing contact info */}
            {skippedCount > 0 && (
              <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-md border border-amber-200 dark:border-amber-900">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {skippedCount} selected record(s) missing a valid {selectedChannel === "email" ? "email address" : "phone number"} and will be automatically skipped.
                </span>
              </div>
            )}

            {/* Sample recipients chips */}
            {validRecipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {validRecipients.slice(0, 4).map((r) => (
                  <Badge key={r.id} variant="outline" className="text-[11px] font-normal bg-background">
                    {r.name}
                    <span className="text-muted-foreground ml-1">
                      ({selectedChannel === "email" ? r.email : r.phone})
                    </span>
                  </Badge>
                ))}
                {validRecipients.length > 4 && (
                  <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                    +{validRecipients.length - 4} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="message-template-select" className="text-xs font-semibold text-muted-foreground">
                  Load Template
                </Label>
                <span className="text-[11px] text-muted-foreground">Optional</span>
              </div>
              <Select onValueChange={handleSelectTemplate} disabled={isSending}>
                <SelectTrigger id="message-template-select" className="h-9 text-xs">
                  <SelectValue placeholder="Choose an existing message template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      {tpl.name}
                      {tpl.description ? ` — ${tpl.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject Field for Email */}
          {selectedChannel === "email" && (
            <div className="space-y-1.5">
              <Label htmlFor="message-subject" className="text-xs font-semibold text-muted-foreground">
                Email Subject
              </Label>
              <Input
                id="message-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quick update for {{company}}"
                className="h-9 text-xs"
                disabled={isSending}
              />
            </div>
          )}

          {/* Personalization Variables Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Personalization Variables
              </Label>
              <span className="text-[11px] text-muted-foreground">Click to insert</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERSONALIZATION_TAGS.map(({ label, tag }) => (
                <Button
                  key={tag}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertTag(tag)}
                  disabled={isSending}
                  className="h-7 text-[11px] px-2 py-0 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                >
                  + {tag}
                </Button>
              ))}
            </div>
          </div>

          {/* Message Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="message-composer-body" className="text-xs font-semibold text-muted-foreground">
                Message Body
              </Label>
              {selectedChannel === "sms" && (
                <span className="text-[11px] text-muted-foreground">
                  {smsLength} chars &bull; {smsSegments} segment{smsSegments > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <Textarea
              id="message-composer-body"
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi {{firstName}}, thanks for connecting with us regarding {{company}}..."
              className="min-h-[140px] text-xs leading-relaxed resize-y font-normal"
              disabled={isSending}
            />
          </div>

          {/* Live Preview Toggle & Card */}
          {message.trim() && sampleRecipient && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? "Hide Preview" : `Preview as ${sampleRecipient.name}`}
              </button>

              {showPreview && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5 text-foreground animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1 border-b">
                    <span>
                      Previewing recipient: <strong className="text-foreground">{sampleRecipient.name}</strong> ({sampleRecipient.company || "No Company"})
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedChannel.toUpperCase()}
                    </Badge>
                  </div>
                  {selectedChannel === "email" && subject && (
                    <p className="font-semibold text-xs text-foreground">
                      Subject: {resolveMergeTags(subject, { firstName: sampleRecipient.firstName, company: sampleRecipient.company })}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">
                    {previewMessage}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 sm:justify-between border-t mt-2">
          <div className="hidden sm:flex items-center text-[11px] text-muted-foreground gap-1">
            <Info className="h-3.5 w-3.5" />
            <span>Variables are replaced uniquely per recipient</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={isSending || validRecipients.length === 0 || !message.trim()}
              className="h-8 text-xs gap-1.5"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send to {validRecipients.length} Recipient{validRecipients.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
