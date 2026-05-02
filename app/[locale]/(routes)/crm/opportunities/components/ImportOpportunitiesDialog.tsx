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

type RawRow = Record<string, string>;
type MappingKey =
  | "external_id"
  | "created_time"
  | "ad_id"
  | "opportunity_name"
  | "adset_id"
  | "adset_name"
  | "campaign_id"
  | "campaign_name"
  | "form_id"
  | "form_name"
  | "is_organic"
  | "platform"
  | "budget"
  | "full_name"
  | "phone_number"
  | "lead_status";
type ColumnMapping = Record<MappingKey, string>;
type ImportFailure = {
  row: number;
  name: string | null;
  reason: string;
};
type ImportResult = {
  imported: number;
  failed: number;
  failures: ImportFailure[];
};

const SKIP_VALUE = "__skip__";
const IMPORT_FIELDS: Array<{ key: MappingKey; label: string }> = [
  { key: "external_id", label: "id" },
  { key: "created_time", label: "created_time" },
  { key: "ad_id", label: "ad_id" },
  { key: "opportunity_name", label: "ad_name (Opportunity name)" },
  { key: "adset_id", label: "adset_id" },
  { key: "adset_name", label: "adset_name" },
  { key: "campaign_id", label: "campaign_id" },
  { key: "campaign_name", label: "campaign_name" },
  { key: "form_id", label: "form_id" },
  { key: "form_name", label: "form_name" },
  { key: "is_organic", label: "is_organic" },
  { key: "platform", label: "platform" },
  {
    key: "budget",
    label: "what_is_your_budget_for_website_development?",
  },
  { key: "full_name", label: "full name" },
  { key: "phone_number", label: "phone_number" },
  { key: "lead_status", label: "lead_status" },
];

const DEFAULT_MAPPING = Object.fromEntries(
  IMPORT_FIELDS.map(({ key }) => [key, SKIP_VALUE]),
) as ColumnMapping;

const AUTO_MAP_CANDIDATES: Record<MappingKey, string[]> = {
  external_id: ["id", "lead id", "lead_id"],
  created_time: ["created_time", "created time", "created_at", "time"],
  ad_id: ["ad_id", "ad id"],
  opportunity_name: ["ad_name", "ad name", "opportunity name", "opportunity_name", "name"],
  adset_id: ["adset_id", "adset id"],
  adset_name: ["adset_name", "adset name"],
  campaign_id: ["campaign_id", "campaign id"],
  campaign_name: ["campaign_name", "campaign name"],
  form_id: ["form_id", "form id"],
  form_name: ["form_name", "form name"],
  is_organic: ["is_organic", "organic", "is organic"],
  platform: ["platform", "source platform", "channel"],
  budget: [
    "what_is_your_budget_for_website_development?",
    "website development budget",
    "budget",
  ],
  full_name: ["full name", "fullname", "full_name", "name"],
  phone_number: ["phone_number", "phone number", "phone", "mobile", "mobile phone"],
  lead_status: ["lead_status", "lead status", "status"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function suggestMapping(headers: string[]): ColumnMapping {
  const defaults: ColumnMapping = { ...DEFAULT_MAPPING };

  for (const key of Object.keys(defaults) as MappingKey[]) {
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return AUTO_MAP_CANDIDATES[key].some(
        (candidate) =>
          normalized === candidate || normalized.includes(candidate),
      );
    });

    if (match) {
      defaults[key] = match;
    }
  }

  return defaults;
}

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

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({ ...DEFAULT_MAPPING });
    setResult(null);
    setIsUploading(false);
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
      const name =
        mapping.opportunity_name !== SKIP_VALUE
          ? String(row[mapping.opportunity_name] ?? "").trim()
          : "";
      const fullName =
        mapping.full_name !== SKIP_VALUE
          ? String(row[mapping.full_name] ?? "").trim()
          : "";
      const phoneNumber =
        mapping.phone_number !== SKIP_VALUE
          ? String(row[mapping.phone_number] ?? "").trim()
          : "";
      const budget =
        mapping.budget !== SKIP_VALUE
          ? String(row[mapping.budget] ?? "").trim()
          : "";
      const platform =
        mapping.platform !== SKIP_VALUE
          ? String(row[mapping.platform] ?? "").trim()
          : "";

      return {
        row: index + 2,
        name,
        fullName,
        phoneNumber,
        budget,
        platform,
        valid: Boolean(name),
      };
    });
  }, [mapping, rows]);

  const validRowCount = useMemo(() => {
    if (mapping.opportunity_name === SKIP_VALUE) {
      return 0;
    }

    return rows.filter(
      (row) => String(row[mapping.opportunity_name] ?? "").trim().length > 0,
    ).length;
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
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const parsedRows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
        defval: "",
        raw: false,
      });

      const nextHeaders = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
      if (nextHeaders.length === 0) {
        throw new Error("The selected file does not contain any importable rows.");
      }

      setHeaders(nextHeaders);
      setRows(
        parsedRows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()]),
          ),
        ),
      );
      setMapping(suggestMapping(nextHeaders));
      setOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read the selected file";
      reset();
      toast.error(message);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0 || mapping.opportunity_name === SKIP_VALUE) {
      return;
    }

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
          mapping,
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
          `${payload.imported} opportunity import(s) completed with ${payload.failed} issue(s).`,
        );
      } else {
        toast.success(`${payload.imported} opportunity import(s) completed.`);
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
            <DialogTitle>Import WhatsApp Leads</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file, map the WhatsApp lead columns, and import
              each valid row as an opportunity. `ad_name` is used as the opportunity
              name and the remaining lead fields are preserved in the description.
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

            {headers.length > 0 ? (
              <div className="space-y-4 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-medium">Column Mapping</h3>
                  <p className="text-xs text-muted-foreground">
                    Match your uploaded columns to the WhatsApp lead fields used for opportunity import.
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

            {mappedPreview.length > 0 ? (
              <div className="space-y-2 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-medium">Mapped Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Valid rows ready to import: {validRowCount}. Rows that will be
                    skipped for missing opportunity name: {skippedInvalidCount}.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>Full name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreview.map((row) => (
                        <TableRow key={row.row}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.name || "Missing ad_name"}</TableCell>
                          <TableCell>{row.fullName || "N/A"}</TableCell>
                          <TableCell>{row.phoneNumber || "N/A"}</TableCell>
                          <TableCell>{row.budget || "N/A"}</TableCell>
                          <TableCell>{row.platform || "N/A"}</TableCell>
                          <TableCell>
                            {row.valid ? (
                              <span className="text-green-600">Ready</span>
                            ) : (
                              <span className="text-yellow-600">Needs ad_name</span>
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
                disabled={isUploading || rows.length === 0 || mapping.opportunity_name === SKIP_VALUE}
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
              {headers.length > 0 && mapping.opportunity_name === SKIP_VALUE ? (
                <p className="text-xs text-destructive">
                  `ad_name` mapping is required because it becomes the opportunity name.
                </p>
              ) : null}
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
                          {failure.name ? `(${failure.name})` : ""}: {failure.reason}
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
