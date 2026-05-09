"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
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
import { EmailLink, WhatsAppLink } from "@/components/ui/contact-link";

type RawRow = Record<string, string>;
type MappingKey =
  | "accountName"
  | "email"
  | "phone"
  | "website"
  | "fax"
  | "company_id"
  | "vat"
  | "annual_revenue"
  | "employees"
  | "member_of"
  | "industry"
  | "type"
  | "status"
  | "description"
  | "assigned_to"
  | "billing_street"
  | "billing_postal_code"
  | "billing_city"
  | "billing_state"
  | "billing_country"
  | "shipping_street"
  | "shipping_postal_code"
  | "shipping_city"
  | "shipping_state"
  | "shipping_country";
type ColumnMapping = Record<MappingKey, string>;
type ImportFailure = {
  row: number;
  name: string | null;
  reason: string;
};
type ImportResult = {
  imported: number;
  updated: number;
  failed: number;
  failures: ImportFailure[];
};

const SKIP_VALUE = "__skip__";
const IMPORT_FIELDS: Array<{ key: MappingKey; label: string }> = [
  { key: "accountName", label: "Company Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "fax", label: "Fax" },
  { key: "company_id", label: "Company ID" },
  { key: "vat", label: "VAT" },
  { key: "annual_revenue", label: "Annual revenue" },
  { key: "employees", label: "Employees" },
  { key: "member_of", label: "Member of" },
  { key: "industry", label: "Industry" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "description", label: "Description" },
  { key: "assigned_to", label: "Assigned member" },
  { key: "billing_street", label: "Billing street" },
  { key: "billing_postal_code", label: "Billing postal code" },
  { key: "billing_city", label: "Billing city" },
  { key: "billing_state", label: "Billing state" },
  { key: "billing_country", label: "Billing country" },
  { key: "shipping_street", label: "Shipping street" },
  { key: "shipping_postal_code", label: "Shipping postal code" },
  { key: "shipping_city", label: "Shipping city" },
  { key: "shipping_state", label: "Shipping state" },
  { key: "shipping_country", label: "Shipping country" },
];
const DEFAULT_MAPPING = Object.fromEntries(
  IMPORT_FIELDS.map(({ key }) => [key, SKIP_VALUE]),
) as ColumnMapping;
const AUTO_MAP_CANDIDATES: Record<MappingKey, string[]> = {
  accountName: [
    "company",
    "company name",
    "company_name",
    "account",
    "account name",
    "account_name",
    "name",
  ],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "phone number", "office phone", "office_phone", "telephone", "tel"],
  website: ["website", "web", "url", "site"],
  fax: ["fax"],
  company_id: ["company id", "company_id", "account id", "account_id"],
  vat: ["vat", "vat number", "tax id", "gst", "gstin"],
  annual_revenue: ["annual revenue", "annual_revenue", "revenue"],
  employees: ["employees", "employee count", "number of employees"],
  member_of: ["member of", "member_of", "parent company"],
  industry: ["industry", "industry type"],
  type: ["type", "account type", "company type"],
  status: ["status", "active", "is active"],
  description: ["description", "notes", "note", "details"],
  assigned_to: ["assigned to", "assigned_to", "owner", "user", "assignee"],
  billing_street: ["billing street", "billing_street", "street"],
  billing_postal_code: ["billing postal code", "billing_postal_code", "billing zip"],
  billing_city: ["billing city", "billing_city", "city"],
  billing_state: ["billing state", "billing_state", "state", "region"],
  billing_country: ["billing country", "billing_country", "country"],
  shipping_street: ["shipping street", "shipping_street"],
  shipping_postal_code: ["shipping postal code", "shipping_postal_code", "shipping zip"],
  shipping_city: ["shipping city", "shipping_city"],
  shipping_state: ["shipping state", "shipping_state"],
  shipping_country: ["shipping country", "shipping_country"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestMapping(headers: string[]): ColumnMapping {
  const defaults: ColumnMapping = { ...DEFAULT_MAPPING };

  for (const key of Object.keys(defaults) as MappingKey[]) {
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return AUTO_MAP_CANDIDATES[key].some((candidate) => {
        const normalizedCandidate = normalizeHeader(candidate);
        return (
          normalized === normalizedCandidate ||
          normalized.includes(normalizedCandidate)
        );
      });
    });

    if (match) {
      defaults[key] = match;
    }
  }

  return defaults;
}

export function ImportAccountsDialog() {
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
        mapping.accountName !== SKIP_VALUE
          ? String(row[mapping.accountName] ?? "").trim()
          : "";
      const email =
        mapping.email !== SKIP_VALUE ? String(row[mapping.email] ?? "").trim() : "";
      const phone =
        mapping.phone !== SKIP_VALUE ? String(row[mapping.phone] ?? "").trim() : "";
      const website =
        mapping.website !== SKIP_VALUE
          ? String(row[mapping.website] ?? "").trim()
          : "";

      return {
        row: index + 2,
        name,
        email,
        phone,
        website,
        valid: Boolean(name),
      };
    });
  }, [mapping, rows]);

  const validRowCount = useMemo(() => {
    if (mapping.accountName === SKIP_VALUE) {
      return 0;
    }

    return rows.filter(
      (row) => String(row[mapping.accountName] ?? "").trim().length > 0,
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
            Object.entries(row).map(([key, value]) => [
              key,
              String(value ?? "").trim(),
            ]),
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
    if (rows.length === 0 || mapping.accountName === SKIP_VALUE) {
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const response = await fetch("/api/crm/accounts/import", {
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
          `${payload.imported + payload.updated} account(s) processed with ${payload.failed} issue(s).`,
        );
      } else {
        toast.success(
          `${payload.imported} account(s) imported${payload.updated ? `, ${payload.updated} updated` : ""}.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import accounts";
      toast.error(message);
      setResult({
        imported: 0,
        updated: 0,
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
        data-testid="import-accounts-btn"
        onClick={openFilePicker}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Accounts</DialogTitle>
            <DialogDescription>
              Review the selected CSV or Excel file, map the columns, and import
              valid accounts. Company or Company Name becomes the account name.
              Existing accounts are not duplicated; only blank fields are filled.
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
                    Match your uploaded columns to account fields.
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
                    skipped for missing company name: {skippedInvalidCount}.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreview.map((row) => (
                        <TableRow key={row.row}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.name || "Missing company"}</TableCell>
                          <TableCell>
                            <EmailLink value={row.email} fallback="N/A" />
                          </TableCell>
                          <TableCell>
                            <WhatsAppLink value={row.phone} fallback="N/A" />
                          </TableCell>
                          <TableCell>{row.website || "N/A"}</TableCell>
                          <TableCell>
                            {row.valid ? (
                              <span className="text-green-600">Ready</span>
                            ) : (
                              <span className="text-yellow-600">Needs company</span>
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
                disabled={
                  isUploading ||
                  rows.length === 0 ||
                  mapping.accountName === SKIP_VALUE
                }
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  "Import Accounts"
                )}
              </Button>
              {headers.length > 0 && mapping.accountName === SKIP_VALUE ? (
                <p className="text-xs text-destructive">
                  Company or Company Name mapping is required.
                </p>
              ) : null}
            </div>

            {result ? (
              <div className="space-y-3 rounded-md border p-4">
                {result.imported > 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {result.imported} account(s) imported successfully
                    </span>
                  </div>
                ) : null}

                {result.updated > 0 ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {result.updated} existing account(s) filled with missing data
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
