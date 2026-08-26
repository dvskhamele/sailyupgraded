"use client";

import * as React from "react";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Tag,
  FileText,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Copy,
  Check,
  ExternalLink,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmailLink, WhatsAppLink } from "@/components/ui/contact-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PeopleRecord } from "@/types/people";

interface PeopleDetailSheetProps {
  record: PeopleRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PeopleDetailSheet({
  record,
  open,
  onOpenChange,
}: PeopleDetailSheetProps) {
  const [copied, setCopied] = React.useState(false);

  if (!record) return null;

  const isAccount = record.type === "Account";
  const formattedCreated = record.createdAt
    ? moment(record.createdAt).format("MMMM Do YYYY, h:mm a")
    : null;
  const formattedUpdated = record.updatedAt
    ? moment(record.updatedAt).format("MMMM Do YYYY, h:mm a")
    : null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(record.originalId || record.id);
    setCopied(true);
    toast.success("ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto w-full p-6">
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <Badge
              variant={isAccount ? "default" : "secondary"}
              className={
                isAccount
                  ? "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                  : "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
              }
            >
              {isAccount ? (
                <Building2 className="mr-1 h-3.5 w-3.5" />
              ) : (
                <User className="mr-1 h-3.5 w-3.5" />
              )}
              {record.type}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="h-8 text-xs text-muted-foreground"
            >
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              Copy ID
            </Button>
          </div>

          <div>
            <SheetTitle className="text-2xl font-bold tracking-tight">
              {record.name}
            </SheetTitle>
            {record.jobTitle && (
              <SheetDescription className="text-sm font-medium text-muted-foreground mt-0.5">
                {record.jobTitle}
                {record.company && record.company !== record.name && (
                  <span> at {record.company}</span>
                )}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-2" />

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="details">Overview & Details</TabsTrigger>
            <TabsTrigger value="raw">Raw API Record</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-0">
            {/* General Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                General Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-3.5 rounded-lg border border-border/50">
                <div>
                  <span className="text-xs text-muted-foreground block">Record Type</span>
                  <span className="font-medium">{record.type}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Status</span>
                  <span className="font-medium">{record.status || "Active"}</span>
                </div>
                {record.role && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Role</span>
                    <span className="font-medium">{record.role}</span>
                  </div>
                )}
                {record.company && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Company / Account</span>
                    <span className="font-medium">{record.company}</span>
                  </div>
                )}
                {record.accountsIDs && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Account Reference ID</span>
                    <span className="font-mono text-xs text-muted-foreground">{record.accountsIDs}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Details */}
            {(record.email || record.phone || record.website || record.personalEmail || record.officePhone || record.mobilePhone) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contact Details
                </h4>
                <div className="space-y-2 text-sm bg-muted/30 p-3.5 rounded-lg border border-border/50">
                  {record.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground min-w-[70px] text-xs">Email:</span>
                      <EmailLink value={record.email} />
                    </div>
                  )}
                  {record.personalEmail && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground min-w-[70px] text-xs">Personal:</span>
                      <EmailLink value={record.personalEmail} />
                    </div>
                  )}
                  {record.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground min-w-[70px] text-xs">Phone:</span>
                      <WhatsAppLink value={record.phone} />
                    </div>
                  )}
                  {record.mobilePhone && record.mobilePhone !== record.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground min-w-[70px] text-xs">Mobile:</span>
                      <WhatsAppLink value={record.mobilePhone} />
                    </div>
                  )}
                  {record.officePhone && record.officePhone !== record.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground min-w-[70px] text-xs">Office:</span>
                      <span>{record.officePhone}</span>
                    </div>
                  )}
                  {record.website && (
                    <div className="flex items-center gap-2.5">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground min-w-[70px] text-xs">Website:</span>
                      <a
                        href={record.website.startsWith("http") ? record.website : `https://${record.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {record.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Social Links */}
            {(record.socialLinkedin || record.socialTwitter || record.socialFacebook || record.socialInstagram || record.socialYoutube) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Social Profiles
                </h4>
                <div className="flex flex-wrap gap-2">
                  {record.socialLinkedin && (
                    <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                      <a
                        href={record.socialLinkedin.startsWith("http") ? record.socialLinkedin : `https://${record.socialLinkedin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                        LinkedIn
                      </a>
                    </Button>
                  )}
                  {record.socialTwitter && (
                    <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                      <a
                        href={record.socialTwitter.startsWith("http") ? record.socialTwitter : `https://${record.socialTwitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Twitter className="h-3.5 w-3.5 text-[#1DA1F2]" />
                        Twitter
                      </a>
                    </Button>
                  )}
                  {record.socialFacebook && (
                    <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                      <a
                        href={record.socialFacebook.startsWith("http") ? record.socialFacebook : `https://${record.socialFacebook}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                        Facebook
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Location & Address */}
            {(record.city || record.state || record.country || record.postalCode || record.address) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Location & Address
                </h4>
                <div className="flex items-start gap-2.5 text-sm bg-muted/30 p-3.5 rounded-lg border border-border/50">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {record.address && <p>{record.address}</p>}
                    <p className="text-muted-foreground">
                      {[record.city, record.state, record.postalCode].filter(Boolean).join(", ")}
                    </p>
                    {record.country && (
                      <p className="font-medium text-foreground">{record.country}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes & Description */}
            {(record.description || record.notes || record.tags) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes & Details
                </h4>
                <div className="space-y-2 text-sm bg-muted/30 p-3.5 rounded-lg border border-border/50">
                  {record.tags && (
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Tags:</span>
                      <span>{record.tags}</span>
                    </div>
                  )}
                  {(record.description || record.notes) && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                        {record.description || record.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="space-y-2 text-xs text-muted-foreground pt-2">
              {formattedCreated && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created: {formattedCreated}</span>
                </div>
              )}
              {formattedUpdated && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Updated: {formattedUpdated}</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="raw" className="mt-0">
            <div className="bg-muted/50 p-3.5 rounded-lg border border-border font-mono text-xs overflow-x-auto max-h-[500px]">
              <pre>{JSON.stringify(record.raw, null, 2)}</pre>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
