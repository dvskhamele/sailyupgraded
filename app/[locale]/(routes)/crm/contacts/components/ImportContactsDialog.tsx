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
  | "serial"
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "personal_email"
  | "mobile_phone"
  | "office_phone"
  | "website"
  | "position"
  | "description"
  | "birthday"
  | "address"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "country"
  | "postal_code"
  | "status"
  | "role"
  | "contact_type_id"
  | "assigned_to"
  | "assigned_account"
  | "social_twitter"
  | "social_facebook"
  | "social_linkedin"
  | "social_skype"
  | "social_youtube"
  | "social_tiktok";
type ColumnMapping = Record<MappingKey, string>;
type DuplicateMode = "skip" | "update";
type ImportFailure = {
  row: number;
  email: string | null;
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
  { key: "serial", label: "Role ID / Agent Number" },
  { key: "name", label: "Full name" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "personal_email", label: "Personal email" },
  { key: "mobile_phone", label: "Mobile phone" },
  { key: "office_phone", label: "Office phone" },
  { key: "website", label: "Website" },
  { key: "position", label: "Position" },
  { key: "description", label: "Description" },
  { key: "birthday", label: "Birthday" },
  { key: "address", label: "Address" },
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Region" },
  { key: "country", label: "Country" },
  { key: "postal_code", label: "Postal code" },
  { key: "status", label: "Status" },
  { key: "role", label: "Role" },
  { key: "contact_type_id", label: "Contact type" },
  { key: "assigned_to", label: "Assigned member" },
  { key: "assigned_account", label: "Assigned company" },
  { key: "social_twitter", label: "Twitter" },
  { key: "social_facebook", label: "Facebook" },
  { key: "social_linkedin", label: "LinkedIn" },
  { key: "social_skype", label: "Thread" },
  { key: "social_youtube", label: "YouTube" },
  { key: "social_tiktok", label: "TikTok" },
];
const DEFAULT_MAPPING = Object.fromEntries(
  IMPORT_FIELDS.map(({ key }) => [key, SKIP_VALUE]),
) as ColumnMapping;
const AUTO_MAP_CANDIDATES: Record<MappingKey, string[]> = {
  serial: [
    "serial",
    "sr no",
    "sr_no",
    "sequence",
    "agent number",
    "agent no",
    "agent id",
    "customer id",
    "customer number",
    "client id",
    "partner id",
    "partner number",
    "vendor id",
    "vendor number",
  ],
  name: ["name", "full name", "full_name", "contact name"],
  first_name: ["first name", "firstname", "first_name", "given name"],
  last_name: ["last name", "lastname", "last_name", "surname", "family name"],
  email: ["email", "e-mail", "email address", "mail"],
  personal_email: ["personal email", "personal_email", "private email"],
  mobile_phone: ["mobile", "mobile phone", "mobile_phone", "cell", "cell phone"],
  office_phone: ["office phone", "office_phone", "telephone", "tel", "work phone", "phone"],
  website: ["website", "web", "url", "site"],
  position: ["position", "job title", "title", "designation"],
  description: ["description", "notes", "note", "details"],
  birthday: ["birthday", "birth date", "birthdate", "dob"],
  address: ["address", "full address"],
  address_line1: ["address line 1", "address_line1", "street", "street 1"],
  address_line2: ["address line 2", "address_line2", "street 2"],
  city: ["city", "town"],
  state: ["state", "region", "province"],
  country: ["country"],
  postal_code: ["postal code", "postal_code", "zip", "zip code", "pincode"],
  status: ["status", "active", "is active", "is_active"],
  role: ["role"],
  contact_type_id: ["contact type", "contact_type", "contact_type_id", "type"],
  assigned_to: ["assigned to", "assigned_to", "owner", "user", "assignee"],
  assigned_account: ["account", "assigned account", "assigned_account", "company"],
  social_twitter: ["twitter", "x"],
  social_facebook: ["facebook"],
  social_linkedin: ["linkedin", "linkedin url", "linkedin profile"],
  social_skype: ["thread", "skype"],
  social_youtube: ["youtube"],
  social_tiktok: ["tiktok", "tik tok"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function normalizeHeaderToken(value: string) {
  return normalizeHeader(value).replace(/[^a-z0-9]/g, "");
}

function suggestMapping(headers: string[]): ColumnMapping {
  const defaults: ColumnMapping = { ...DEFAULT_MAPPING };

  for (const key of Object.keys(defaults) as MappingKey[]) {
    const match = headers.find((header) => {
      const normalized = normalizeHeaderToken(header);
      return AUTO_MAP_CANDIDATES[key].some(
        (candidate) =>
          normalized === normalizeHeaderToken(candidate) ||
          normalized.includes(normalizeHeaderToken(candidate)),
      );
    });

    if (match) {
      defaults[key] = match;
    }
  }

  return defaults;
}

export function ImportContactsDialog() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    ...DEFAULT_MAPPING,
  });
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({ ...DEFAULT_MAPPING });
    setDuplicateMode("skip");
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
      const email = mapping.email !== SKIP_VALUE ? String(row[mapping.email] ?? "").trim() : "";
      const firstName =
        mapping.first_name !== SKIP_VALUE ? String(row[mapping.first_name] ?? "").trim() : "";
      const lastName =
        mapping.last_name !== SKIP_VALUE ? String(row[mapping.last_name] ?? "").trim() : "";
      const fullName =
        mapping.name !== SKIP_VALUE ? String(row[mapping.name] ?? "").trim() : "";
      const mobilePhone =
        mapping.mobile_phone !== SKIP_VALUE ? String(row[mapping.mobile_phone] ?? "").trim() : "";
      const officePhone =
        mapping.office_phone !== SKIP_VALUE ? String(row[mapping.office_phone] ?? "").trim() : "";
      const status =
        mapping.status !== SKIP_VALUE ? String(row[mapping.status] ?? "").trim() : "";
      const name = fullName || [firstName, lastName].filter(Boolean).join(" ");

      return {
        row: index + 2,
        name,
        email,
        phone: mobilePhone || officePhone,
        status,
        valid: Boolean(name || lastName) && Boolean(email || mobilePhone || officePhone),
      };
    });
  }, [mapping, rows]);

  const validRowCount = useMemo(() => {
    return rows.filter((row) => {
      const hasName = (
        (mapping.name !== SKIP_VALUE && String(row[mapping.name] ?? "").trim().length > 0) ||
        (mapping.last_name !== SKIP_VALUE &&
          String(row[mapping.last_name] ?? "").trim().length > 0)
      );
      const hasEmail =
        mapping.email !== SKIP_VALUE &&
        String(row[mapping.email] ?? "").trim().length > 0;
      const hasMobilePhone =
        mapping.mobile_phone !== SKIP_VALUE &&
        String(row[mapping.mobile_phone] ?? "").trim().length > 0;
      const hasOfficePhone =
        mapping.office_phone !== SKIP_VALUE &&
        String(row[mapping.office_phone] ?? "").trim().length > 0;

      return hasName && (hasEmail || hasMobilePhone || hasOfficePhone);
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
    if (
      rows.length === 0 ||
      (mapping.name === SKIP_VALUE && mapping.last_name === SKIP_VALUE) ||
      (mapping.email === SKIP_VALUE &&
        mapping.mobile_phone === SKIP_VALUE &&
        mapping.office_phone === SKIP_VALUE)
    ) {
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const response = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows,
          mapping,
          duplicateMode,
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
          `${payload.imported + payload.updated} contact(s) processed with ${payload.failed} issue(s).`,
        );
      } else {
        toast.success(
          `${payload.imported} contact(s) imported${payload.updated ? `, ${payload.updated} updated` : ""}.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import contacts";
      toast.error(message);
      setResult({
        imported: 0,
        updated: 0,
        failed: 1,
        failures: [{ row: 0, email: null, reason: message }],
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
        data-testid="import-contacts-btn"
        onClick={openFilePicker}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import Contacts
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Review the selected CSV or Excel file, map the columns, and import
              valid contacts. Each row must include a full name or last name, and
              at least one of email, mobile phone, or office phone.
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
                    Match your uploaded columns to the contact fields we import.
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
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Duplicates</p>
                    <Select
                      value={duplicateMode}
                      onValueChange={(value) =>
                        setDuplicateMode(value as DuplicateMode)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select behavior" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip existing contacts</SelectItem>
                        <SelectItem value="update">Update existing contacts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    skipped for missing required values: {skippedInvalidCount}.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Imported status</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreview.map((row) => (
                        <TableRow key={row.row}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.name || "N/A"}</TableCell>
                          <TableCell>
                            <EmailLink value={row.email} fallback="Missing email" />
                          </TableCell>
                          <TableCell>
                            <WhatsAppLink value={row.phone} fallback="N/A" />
                          </TableCell>
                          <TableCell>{row.status || "N/A"}</TableCell>
                          <TableCell>
                            {row.valid ? (
                              <span className="text-green-600">Ready</span>
                            ) : (
                              <span className="text-yellow-600">Needs required fields</span>
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
                  (mapping.name === SKIP_VALUE && mapping.last_name === SKIP_VALUE) ||
                  (mapping.email === SKIP_VALUE &&
                    mapping.mobile_phone === SKIP_VALUE &&
                    mapping.office_phone === SKIP_VALUE)
                }
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  "Import Contacts"
                )}
              </Button>
              {headers.length > 0 &&
              ((mapping.name === SKIP_VALUE && mapping.last_name === SKIP_VALUE) ||
                (mapping.email === SKIP_VALUE &&
                  mapping.mobile_phone === SKIP_VALUE &&
                  mapping.office_phone === SKIP_VALUE)) ? (
                <p className="text-xs text-destructive">
                  Full name or last name, and at least one of email, mobile phone, or office phone are required.
                </p>
              ) : null}
            </div>

            {result ? (
              <div className="space-y-3 rounded-md border p-4">
                {result.imported > 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {result.imported} contact(s) imported successfully
                    </span>
                  </div>
                ) : null}

                {result.updated > 0 ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {result.updated} contact(s) updated successfully
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
                          {failure.email ? `(${failure.email})` : ""}:{" "}
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
