"use client";

import * as React from "react";
import {
  UserCheck,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  convertPeopleToContacts,
  convertPeopleToLeads,
  type ConvertPeopleResult,
} from "@/actions/crm/people/convert-people";
import type { PeopleRecord } from "@/types/people";

export interface PeopleConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "contact" | "lead";
  selectedRecords: PeopleRecord[];
  onConversionComplete?: (result: ConvertPeopleResult) => void;
}

export function PeopleConvertDialog({
  open,
  onOpenChange,
  mode,
  selectedRecords,
  onConversionComplete,
}: PeopleConvertDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [conversionResult, setConversionResult] = React.useState<ConvertPeopleResult | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setConversionResult(null);
      setIsProcessing(false);
    }
  }, [open]);

  const targetLabel = mode === "contact" ? "Contact" : "Lead";
  const targetLabelPlural = mode === "contact" ? "Contacts" : "Leads";
  const Icon = mode === "contact" ? UserCheck : UserPlus;

  const handleConvert = async () => {
    if (selectedRecords.length === 0) {
      toast.error("No records selected.");
      return;
    }

    setIsProcessing(true);
    try {
      let result: ConvertPeopleResult;
      if (mode === "contact") {
        result = await convertPeopleToContacts(selectedRecords);
      } else {
        result = await convertPeopleToLeads(selectedRecords);
      }

      setConversionResult(result);

      if (result.convertedCount > 0) {
        toast.success(
          `Converted ${result.convertedCount} of ${selectedRecords.length} record(s) into ${targetLabelPlural}.`
        );
      } else if (result.alreadyExistsCount > 0 && result.failedCount === 0) {
        toast.info(
          `All ${result.alreadyExistsCount} selected record(s) already exist as ${targetLabelPlural}.`
        );
      } else if (result.failedCount > 0) {
        toast.error(
          result.error || `${result.failedCount} record(s) could not be converted.`
        );
      }

      onConversionComplete?.(result);
    } catch (err: any) {
      console.error("Conversion error:", err);
      toast.error(err.message || `Failed to convert records into ${targetLabelPlural}.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5 text-primary" />
            {conversionResult
              ? "Conversion completed"
              : `Convert to ${targetLabel}?`}
          </DialogTitle>
          <DialogDescription>
            {conversionResult
              ? `Results for converting ${selectedRecords.length} selected record(s) into ${targetLabelPlural}.`
              : `You are about to convert ${selectedRecords.length} selected record(s) into ${targetLabelPlural}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Confirmation Stage */}
        {!conversionResult && !isProcessing && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between font-medium text-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  <span>
                    <strong>{selectedRecords.length}</strong> record(s) selected
                  </span>
                </div>
                <Badge variant="outline" className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Duplicate Protection Active
                </Badge>
              </div>

              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Eligible fields (Name, Email, Phone, Company, Job Title, Address, Socials, Notes, Custom Fields) will be preserved. Existing records will be automatically detected and protected from duplication.
              </p>
            </div>

            {/* Selected items preview list */}
            <div className="space-y-1.5 flex-1 min-h-[140px] max-h-[220px] flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground">
                Selected Records ({selectedRecords.length})
              </span>
              <ScrollArea className="flex-1 rounded-md border p-2 bg-background">
                <div className="space-y-1.5">
                  {selectedRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate text-foreground">
                          {record.fullName || record.name}
                        </span>
                        {record.company && (
                          <span className="text-muted-foreground truncate text-[11px]">
                            &bull; {record.company}
                          </span>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {record.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Converting into {targetLabelPlural}...
              </h4>
              <p className="text-xs text-muted-foreground">
                Validating fields, checking duplicates, and creating records.
              </p>
            </div>
          </div>
        )}

        {/* Conversion Result Summary View */}
        {conversionResult && !isProcessing && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            {/* Stat Counters */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-bold text-lg">{conversionResult.convertedCount}</span>
                </div>
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Converted
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-bold text-lg">{conversionResult.alreadyExistsCount}</span>
                </div>
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  Already Existed
                </p>
              </div>

              <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 mb-1">
                  <XCircle className="h-4 w-4" />
                  <span className="font-bold text-lg">{conversionResult.failedCount}</span>
                </div>
                <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                  Failed / Skipped
                </p>
              </div>
            </div>

            {/* Itemized Results List */}
            <div className="space-y-1.5 flex-1 min-h-[140px] max-h-[220px] flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground">
                Conversion Breakdown
              </span>
              <ScrollArea className="flex-1 rounded-md border p-2 bg-background">
                <div className="space-y-1.5">
                  {conversionResult.results.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 text-xs py-1.5 px-2 rounded-md border bg-muted/20"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span className="font-medium text-foreground truncate block">
                          {item.name}
                        </span>
                        {item.message && (
                          <span className="text-muted-foreground text-[11px] block leading-tight">
                            {item.message}
                          </span>
                        )}
                      </div>

                      {item.status === "converted" && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 shrink-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Converted
                        </Badge>
                      )}
                      {item.status === "already_exists" && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 shrink-0">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Already Exists
                        </Badge>
                      )}
                      {item.status === "failed" && (
                        <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40 shrink-0">
                          <XCircle className="h-3 w-3 mr-1" />
                          Skipped
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 sm:justify-end border-t mt-2">
          {!conversionResult ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isProcessing}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConvert}
                disabled={isProcessing || selectedRecords.length === 0}
                className="h-8 text-xs gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Icon className="h-3.5 w-3.5" />
                    Convert to {targetLabel}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleClose}
              className="h-8 text-xs"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
