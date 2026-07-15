"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { parseWorkbookRows, type ImportRawRow } from "@/lib/crm/workbook-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RawRow = ImportRawRow;

type ImportFailure = {
  row: number;
  name: string | null;
  reason: string;
};

type ImportResult = {
  imported: number;
  failed: number;
  failures: ImportFailure[];
  summary?: {
    totalRows: number;
    importedRows: number;
    skippedRows: number;
    validationErrors: ImportFailure[];
    mappedFields: string[];
    customFields: string[];
  };
};

// ---------------------------------------------------------------------------
// Manual mapping types and constants (fallback UI)
// ---------------------------------------------------------------------------

const SKIP_VALUE = "__skip__";

type MappingKey =
  | "name"
  | "account"
  | "assigned_to"
  | "budget"
  | "close_date"
  | "sales_stage"
  | "type"
  | "description"
  | "next_step"
  | "campaign"
  | "contact"
  | "currency"
  | "expected_revenue"
  | "clientName"
  | "category";

type ColumnMapping = Record<MappingKey, string>;

const IMPORT_FIELDS: Array<{ key: MappingKey; label: string }> = [
  { key: "name", label: "Opportunity Name" },
  { key: "account", label: "Account / Company" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "budget", label: "Budget / Amount" },
  { key: "close_date", label: "Close Date" },
  { key: "sales_stage", label: "Sales Stage / Pipeline Stage" },
  { key: "type", label: "Type / Sale Type" },
  { key: "description", label: "Description" },
  { key: "next_step", label: "Next Step" },
  { key: "campaign", label: "Campaign" },
  { key: "contact", label: "Contact" },
  { key: "currency", label: "Currency" },
  { key: "expected_revenue", label: "Expected Revenue" },
  { key: "clientName", label: "Client Name" },
  { key: "category", label: "Category / Product" },
];

const DEFAULT_MAPPING = Object.fromEntries(
  IMPORT_FIELDS.map(({ key }) => [key, SKIP_VALUE]),
) as ColumnMapping;

// Smart auto-mapping using the same normalization as the backend
const AUTO_MAP_CANDIDATES: Record<MappingKey, string[]> = {
  name: ["opportunity name", "deal name", "opportunity", "deal", "title", "ad name", "opportunityname", "dealname"],
  account: ["account", "account name", "company", "company name", "organization", "organisation", "client", "client name", "accountname", "companyname"],
  assigned_to: ["assigned to", "owner", "user", "assignee", "sales person", "responsible", "assignedto"],
  budget: ["budget", "value", "deal value", "amount", "opportunity value", "revenue", "price", "project value", "contract value", "dealvalue"],
  close_date: ["close date", "closing date", "expected close", "deadline", "target date", "closedate", "closingdate", "expectedclose"],
  sales_stage: ["sales stage", "stage", "pipeline stage", "deal stage", "opportunity stage", "status", "salesstage", "pipelinestage"],
  type: ["type", "opportunity type", "deal type", "sale type", "category", "opportunitytype"],
  description: ["description", "notes", "details", "comments", "remarks"],
  next_step: ["next step", "next action", "follow up", "nextstep"],
  campaign: ["campaign", "campaign name", "source campaign", "campaignname", "campaign id"],
  contact: ["contact", "contact name", "primary contact", "customer name", "contactname"],
  currency: ["currency", "currency code", "currency name", "currencycode"],
  expected_revenue: ["expected revenue", "forecasted revenue", "projected revenue", "expectedrevenue"],
  clientName: ["client name", "customer", "customer name", "prospect name", "clientname", "customername"],
  category: ["category", "product", "product name", "service", "service type", "productname"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestMapping(headers: string[]): ColumnMapping {
  const defaults: ColumnMapping = { ...DEFAULT_MAPPING };
  const usedHeaders = new Set<string>();

  for (const key of Object.keys(DEFAULT_MAPPING) as MappingKey[]) {
    const match = headers.find((header) => {
      if (usedHeaders.has(header)) return false;
      const normalized = normalizeHeader(header);
      return AUTO_MAP_CANDIDATES[key].some(
        (candidate) =>
          normalized === normalizeHeader(candidate) ||
          normalized.includes(normalizeHeader(candidate)),
      );
    });

    if (match) {
      defaults[key] = match;
      usedHeaders.add(match);
    }
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportOpportunitiesDialog() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ ...DEFAULT_MAPPING });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({ ...DEFAULT_MAPPING });
    setResult(null);
    setIsUploading(false);
    setShowMapping(false);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const mappedPreview = useMemo(() => {
    return rows.slice(0, 10).map((row, index) => {
      const name = mapping.name !== SKIP_VALUE
        ? String(row[mapping.name] ?? "").trim()
        : "";
      const account = mapping.account !== SKIP_VALUE
        ? String(row[mapping.account] ?? "").trim()
        : "";
      const budget = mapping.budget !== SKIP_VALUE
        ? String(row[mapping.budget] ?? "").trim()
        : "";
      const salesStage = mapping.sales_stage !== SKIP_VALUE
        ? String(row[mapping.sales_stage] ?? "").trim()
        : "";
      const closeDate = mapping.close_date !== SKIP_VALUE
        ? String(row[mapping.close_date] ?? "").trim()
        : "";

      return {
        row: index + 2,
        name,
        account,
        budget,
        salesStage,
        closeDate,
        valid: Boolean(name || salesStage),
      };
    });
  }, [mapping, rows]);

  const validRowCount = useMemo(() => {
    return rows.filter((row) => {
      const hasName = mapping.name !== SKIP_VALUE &&
        String(row[mapping.name] ?? "").trim().length > 0;
      const hasStage = mapping.sales_stage !== SKIP_VALUE &&
        String(row[mapping.sales_stage] ?? "").trim().length > 0;
      return hasName || hasStage;
    }).length;
  }, [mapping, rows]);

  const skippedInvalidCount = rows.length - validRowCount;

  const openFilePicker = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setResult(null);
    setFileName(selected.name);

    try {
      const buffer = await selected.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        raw: false,
        cellDates: false,
      });
      const { headers: nextHeaders, rows: parsedRows } = parseWorkbookRows(workbook);

      if (nextHeaders.length === 0) {
        throw new Error("The selected file does not contain any importable rows.");
      }

      setHeaders(nextHeaders);
      setRows(parsedRows);

      // Auto-suggest mapping for manual fallback
      const suggestedMapping = suggestMapping(nextHeaders);
      setMapping(suggestedMapping);

      // Count auto-mapped fields to determine if confidence is high
      const mappedCount = Object.values(suggestedMapping).filter(
        (v: string) => v !== SKIP_VALUE
      ).length;

      // If few fields mapped, show manual mapping UI
      // Otherwise try auto-import directly
      if (mappedCount < 3) {
        setShowMapping(true);
      } else {
        setShowMapping(false);
      }

      setOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read the selected file";
      reset();
      toast.error(message);
    }
  };

  const handleImport = async () => {
    setIsUploading(true);
    setResult(null);

    try {
      const response = await fetch("/api/crm/opportunities/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows,
          mapping: showMapping ? mapping : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Import failed");
      }

      setResult(payload);
      router.refresh();

      if (payload.failed > 0) {
        toast.warning(
          `${payload.imported ?? 0} opportunity(s) imported with ${payload.failed} issue(s).`,
        );
      } else {
        toast.success(
          `${payload.imported ?? 0} opportunity(s) imported.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import opportunities";
      toast.error(message);
      setResult({
        imported: 0,
        failed: 1,
        failures: [{ row: 0, name: null, reason: message }],
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Compute summary from result
  const summary = result?.summary;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        data-testid="import-opportunities-btn"
        onClick={openFilePicker}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Opportunities</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file. Fields are auto-detected and mapped
              intelligently. Unknown columns are stored as custom fields.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-md border p-4">
              {fileName ? (
                <p className="text-xs text-muted-foreground">
                  Selected file: {fileName}
                </p>
              ) : null}
              <div className="mt-3">
                <Button type="button" variant="secondary" size="sm" onClick={openFilePicker}>
                  Choose Another File
                </Button>
              </div>
            </div>

            {/* Toggle manual mapping */}
            {headers.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={showMapping ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowMapping(true)}
                >
                  Manual Mapping
                </Button>
                <Button
                  type="button"
                  variant={showMapping ? "outline" : "default"}
                  size="sm"
                  onClick={() => setShowMapping(false)}
                >
                  Auto-Detect
                </Button>
                {!showMapping && (
                  <p className="text-xs text-muted-foreground ml-2">
                    Fields will be auto-detected. Unknown columns become custom fields.
                  </p>
                )}
              </div>
            )}

            {/* Manual Column Mapping (fallback) */}
            {headers.length > 0 && showMapping ? (
              <div className="space-y-4 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-medium">Column Mapping</h3>
                  <p className="text-xs text-muted-foreground">
                    Match your uploaded columns to opportunity fields. Unknown columns
                    will be stored as custom fields.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {IMPORT_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <p className="text-sm font-medium">{field.label}</p>
                      <Select
                        value={mapping[field.key]}
                        onValueChange={(value) =>
                          setMapping((current) => ({ ...current, [field.key]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${field.label} column`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Auto-detect info */}
            {headers.length > 0 && !showMapping ? (
              <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>Intelligent Auto-Detection enabled.</strong> The system will
                  automatically map {headers.length} detected column(s) to opportunity
                  fields. Columns not matching any field will be saved as custom fields.
                </p>
              </div>
            ) : null}

            {/* Uploaded Data Preview */}
            {previewRows.length > 0 ? (
              <div className="space-y-2 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-medium">Uploaded Data Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Showing the first {previewRows.length} row(s) from the file.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHead key={header} className="whitespace-nowrap">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, index) => (
                        <TableRow key={index}>
                          {headers.map((header) => (
                            <TableCell key={header} className="whitespace-nowrap">
                              {row[header]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {/* Mapped Preview */}
            {mappedPreview.length > 0 ? (
              <div className="space-y-2 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-medium">Mapped Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Valid rows ready to import: {validRowCount}. Empty rows will be skipped.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Close Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreview.map((row) => (
                        <TableRow key={row.row}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.name || "Auto-named"}</TableCell>
                          <TableCell>{row.account || "N/A"}</TableCell>
                          <TableCell>{row.budget || "N/A"}</TableCell>
                          <TableCell>{row.salesStage || "N/A"}</TableCell>
                          <TableCell>{row.closeDate || "N/A"}</TableCell>
                          <TableCell>
                            {row.valid ? (
                              <span className="text-green-600">Ready</span>
                            ) : (
                              <span className="text-yellow-600">Minimal data</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleImport}
                disabled={isUploading || rows.length === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  "Import Opportunities"
                )}
              </Button>
            </div>

            {result ? (
              <div className="space-y-3 rounded-md border p-4">
                {result.imported > 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {result.imported} opportunity(s) imported successfully
                    </span>
                  </div>
                ) : null}

                {result.failed > 0 ? (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {result.failed} row(s) failed or were skipped
                    </span>
                  </div>
                ) : null}

                {/* Enhanced Summary */}
                {summary ? (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <h4 className="text-sm font-medium">Import Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total Rows:</span>{" "}
                        <span className="font-medium">{summary.totalRows}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Imported:</span>{" "}
                        <span className="font-medium text-green-600">{summary.importedRows}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Skipped:</span>{" "}
                        <span className="font-medium text-yellow-600">{summary.skippedRows}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Validation Errors:</span>{" "}
                        <span className="font-medium text-red-600">{summary.validationErrors.length}</span>
                      </div>
                    </div>
                    {summary.mappedFields.length > 0 ? (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Mapped Fields: </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {summary.mappedFields.map((field) => (
                            <Badge key={field} variant="secondary" className="text-[10px]">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {summary.customFields.length > 0 ? (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Custom Fields Detected: </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {summary.customFields.map((field) => (
                            <Badge key={field} variant="outline" className="text-[10px]">
                              custom: {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {result.failures.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Import details</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-md border bg-red-50 p-3 dark:bg-red-950/20">
                      {result.failures.map((failure, index) => (
                        <p
                          key={`${failure.row}-${index}`}
                          className="text-xs text-red-700 dark:text-red-400"
                        >
                          Row {failure.row || "-"}{" "}
                          {failure.name ? `(${failure.name})` : ""}:{" "}
                          {failure.reason}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}