"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import {
  parseContactWorkbookRows,
  type ContactImportRawRow,
} from "@/lib/contact-import-workbook";
import { Badge } from "@/components/ui/badge";
import {
  type CustomFieldDefinition,
  filterCustomFieldsForEntity,
  normalizeHeader as canonicalNormalizeHeader,
} from "@/lib/custom-fields";

type RawRow = ContactImportRawRow;
type ColumnMapping = Record<string, string>;
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
  summary?: {
    totalRows: number;
    importedRows: number;
    updatedRows?: number;
    skippedEmptyRows: number;
    failedRows: number;
    validationErrors: ImportFailure[];
    mappedFields: string[];
    customFields: string[];
    unsupportedColumns?: string[];
  };
};

const SKIP_VALUE = "__skip__";
const IMPORT_FIELDS: Array<{ key: string; label: string; isCustom?: boolean }> = [
  { key: "serial", label: "Agent ID / Serial" },
  { key: "name", label: "Full name" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "personal_email", label: "Personal email" },
  { key: "mobile_phone", label: "Mobile / Cell phone" },
  { key: "office_phone", label: "Office phone" },
  { key: "website", label: "Website" },
  { key: "position", label: "Position" },
  { key: "description", label: "Description" },
  { key: "notes", label: "Notes" },
  { key: "birthday", label: "Birthday / Date of Birth" },
  { key: "country", label: "Country" },
  { key: "address", label: "Address" },
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Region" },
  { key: "postal_code", label: "Postal / Zip code" },
  { key: "status", label: "Status" },
  { key: "role", label: "Role" },
  { key: "agent_level", label: "Agent Level" },
  { key: "created_on", label: "Date Recruited / Entered" },
  { key: "contact_type_id", label: "Contact type" },
  { key: "lead_source_id", label: "Lead source" },
  { key: "lead_type_id", label: "Lead type" },
  { key: "refered_by", label: "Referred by / Recruiter" },
  { key: "campaign", label: "Campaign" },
  { key: "assigned_to", label: "Assigned member" },
  { key: "assigned_account", label: "Assigned company" },
  { key: "visible_to_name", label: "Visibility" },
  { key: "social_twitter", label: "Twitter" },
  { key: "social_facebook", label: "Facebook" },
  { key: "social_linkedin", label: "LinkedIn" },
  { key: "social_skype", label: "Thread / Skype" },
  { key: "social_instagram", label: "Instagram" },
  { key: "social_youtube", label: "YouTube" },
  { key: "social_tiktok", label: "TikTok" },
];
const DEFAULT_MAPPING = Object.fromEntries(
  IMPORT_FIELDS.map(({ key }) => [key, SKIP_VALUE]),
) as ColumnMapping;
const AUTO_MAP_CANDIDATES: Record<string, string[]> = {
  serial: [
    "agent number",
    "agentnumber",
    "agent_number",
    "agent no",
    "agentno",
    "agent id",
    "agentid",
    "agent code",
    "reference id",
    "referenceid",
    "reference_id",
    "reference number",
    "referencenumber",
    "reference_number",
    "role id",
    "roleid",
    "role_id",
    "serial",
    "contact id",
    "contactid",
    "contact_id",
    "sr no",
    "sr_no",
    "sequence",
    "customer id",
    "customer number",
    "client id",
    "client number",
    "other id",
    "other number",
    "partner id",
    "partner number",
    "vendor id",
    "vendor number",
  ],
  name: ["name", "full name", "full_name", "contact name"],
  first_name: ["first name", "firstname", "first_name", "given name", "givenname", "forename"],
  last_name: ["last name", "lastname", "last_name", "surname", "family name", "familyname"],
  email: ["email", "e-mail", "email address", "emailaddress", "mail", "electronic mail"],
  personal_email: ["personal email", "personalemail", "personal_email", "private email", "privateemail"],
  mobile_phone: ["cellphone", "cell phone", "cell_phone", "mobile", "mobile phone", "mobile_phone", "cell", "cell phonenumber"],
  office_phone: ["office phone", "office_phone", "officephone", "telephone", "tel", "work phone", "workphone", "phone", "phone number"],
  website: ["website", "web", "url", "site", "web address", "webaddress"],
  position: ["position", "job title", "title", "designation", "position title"],
  description: ["description", "notes", "note", "details", "about", "summary"],
  notes: ["notes", "note", "internal notes", "internalnotes", "remarks", "comments"],
  birthday: ["date of birth", "dateofbirth", "date_of_birth", "dob", "birthday", "birth date", "birthdate", "birth_date"],
  address: ["address", "full address", "fulladdress", "complete address"],
  address_line1: ["address line 1", "addressline1", "address_line1", "street", "street 1", "address 1", "addresslineone"],
  address_line2: ["address line 2", "addressline2", "address_line2", "street 2", "suite", "apartment", "address 2", "addresslinetwo"],
  city: ["city", "town", "city name"],
  state: ["state", "region", "province", "state name"],
  country: ["country", "country name"],
  postal_code: ["zipcode", "zip code", "zip_code", "zip", "postal code", "postal_code", "postalcode", "pincode", "postcode"],
  status: ["agent status", "agentstatus", "agent_status", "status", "active", "is active", "is_active", "status field"],
  role: ["role", "role field", "contact role"],
  agent_level: ["agent level", "agentlevel", "agent_level", "percent level", "% level", "level", "agent tier", "agent rank"],
  created_on: [
    "date recruited",
    "daterecruited",
    "date_recruited",
    "date entered",
    "dateentered",
    "date_entered",
    "date created",
    "datecreated",
    "date_created",
    "entered date",
    "recruited date",
  ],
  contact_type_id: ["contact type", "contact_type", "contact_type_id", "type", "contact category"],
  lead_source_id: ["lead source", "leadsource", "lead_source", "lead source id", "source"],
  lead_type_id: ["lead type", "leadtype", "lead_type", "lead type id"],
  refered_by: ["referred by", "refered by", "referrer", "referredby", "referedby", "referred_by", "refered_by", "recruiter name", "recruitername", "recruiter_name", "recruiter", "referral"],
  campaign: ["campaign"],
  assigned_to: ["assigned to", "assignedto", "assigned_to", "assigned member", "assignedmember", "owner", "user", "assignee"],
  assigned_account: [
    "assigned company",
    "assignedcompany",
    "assigned_company",
    "assigned account",
    "assignedaccount",
    "company",
    "company name",
    "company_name",
    "organization",
    "organisation",
    "account",
    "account name",
    "accountname",
    "employer",
    "business",
  ],
  visible_to_name: ["visibility", "visible to", "visibleto", "visible_to", "visible to name"],
  social_twitter: ["twitter", "x", "twitter handle", "twitter url", "twitterhandle", "twitterurl"],
  social_facebook: ["facebook", "facebook url", "facebook page", "facebookurl", "facebookpage"],
  social_linkedin: ["linkedin", "linkedin url", "linkedin profile", "linkedinurl", "linkedinprofile"],
  social_skype: ["thread", "threads", "thread handle", "threadhandle", "skype", "skype id", "skypeid"],
  social_instagram: ["instagram", "instagram handle", "instagram url", "instagramhandle", "instagramurl"],
  social_youtube: ["youtube", "youtube channel", "youtube url", "youtubechannel", "youtubeurl"],
  social_tiktok: ["tiktok", "tik tok", "tiktok handle", "tiktok url", "tiktokhandle", "tiktokurl"],
};
const AUTO_MAP_PRIORITY: string[] = [
  "serial",
  "first_name",
  "last_name",
  "email",
  "personal_email",
  "mobile_phone",
  "office_phone",
  "agent_level",
  "created_on",
  "birthday",
  "status",
  "website",
  "assigned_account",
  "assigned_to",
  "lead_source_id",
  "lead_type_id",
  "refered_by",
  "campaign",
  "visible_to_name",
  "notes",
  "description",
  "position",
  "name",
  "address_line1",
  "address_line2",
  "address",
  "city",
  "state",
  "country",
  "postal_code",
  "role",
  "contact_type_id",
  "social_twitter",
  "social_facebook",
  "social_linkedin",
  "social_skype",
  "social_instagram",
  "social_youtube",
  "social_tiktok",
];

function normalizeHeader(value: string) {
  return canonicalNormalizeHeader(value);
}

function suggestMapping(
  headers: string[],
  customFields: CustomFieldDefinition[] = [],
): ColumnMapping {
  const defaults: ColumnMapping = { ...DEFAULT_MAPPING };
  for (const cf of customFields) {
    defaults[`custom:${cf.id}`] = SKIP_VALUE;
  }
  const usedHeaders = new Set<string>();

  // 1. Map standard fields
  for (const key of AUTO_MAP_PRIORITY) {
    const candidates = AUTO_MAP_CANDIDATES[key] ?? [];
    const match = headers.find((header) => {
      if (usedHeaders.has(header)) return false;
      const normalized = normalizeHeader(header);
      return candidates.some(
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

  // 2. Map custom fields
  for (const cf of customFields) {
    const cfKey = `custom:${cf.id}`;
    const normCfName = normalizeHeader(cf.name);
    const normCfId = normalizeHeader(cf.id);

    const match = headers.find((header) => {
      if (usedHeaders.has(header)) return false;
      const normHeader = normalizeHeader(header);
      const strippedHeader = normalizeHeader(header.replace(/^custom_?(field_?)?/i, ""));

      return (
        normHeader === normCfName ||
        strippedHeader === normCfName ||
        normHeader === normCfId ||
        normHeader === normalizeHeader(`custom:${cf.id}`) ||
        header === cf.id ||
        header === `custom:${cf.id}`
      );
    });

    if (match) {
      defaults[cfKey] = match;
      usedHeaders.add(match);
    }
  }

  return defaults;
}

/** Generate a human-readable label from a contact type string */
function getContactTypeLabel(contactType?: string): string {
  switch (contactType?.toLowerCase()) {
    case "customer":
      return "Customer / Client";
    case "agent":
      return "Agent";
    case "prospect":
      return "Prospect";
    case "vendor":
      return "Vendor";
    case "partner":
      return "Partner";
    default:
      return contactType || "Contact";
  }
}

type ImportContactsDialogProps = {
  importRole?: string;
  /** Page context: "customer", "agent", "prospect", "vendor", etc. */
  contactType?: string;
};

export function ImportContactsDialog({ importRole, contactType }: ImportContactsDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    ...DEFAULT_MAPPING,
  });
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/custom-fields")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setCustomFields(data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const applicableCustomFields = useMemo(() => {
    return filterCustomFieldsForEntity(customFields, "Contact", contactType || importRole);
  }, [customFields, contactType, importRole]);

  const allImportFields = useMemo(() => {
    const customList = applicableCustomFields.map((cf) => ({
      key: `custom:${cf.id}`,
      label: `Custom: ${cf.name}`,
      isCustom: true,
    }));
    return [...IMPORT_FIELDS, ...customList];
  }, [applicableCustomFields]);

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

      // Extract custom field values for preview
      const rowCustomFields: Array<{ name: string; value: string }> = [];
      for (const cf of applicableCustomFields) {
        const mappedHeader = mapping[`custom:${cf.id}`];
        if (mappedHeader && mappedHeader !== SKIP_VALUE && row[mappedHeader]) {
          rowCustomFields.push({
            name: cf.name,
            value: String(row[mappedHeader]).trim(),
          });
        }
      }

      // A row is importable if it has at least one non-empty value
      const hasAnyValue = Object.values(row).some((v) => String(v ?? "").trim().length > 0);

      return {
        row: index + 2,
        name,
        email,
        phone: mobilePhone || officePhone,
        status,
        customFields: rowCustomFields,
        valid: hasAnyValue,
      };
    });
  }, [mapping, rows, applicableCustomFields]);

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
      const { headers: nextHeaders, rows: parsedRows } =
        parseContactWorkbookRows(workbook);
      if (nextHeaders.length === 0) {
        throw new Error("The selected file does not contain any importable rows.");
      }

      setHeaders(nextHeaders);
      setRows(parsedRows);
      setMapping(suggestMapping(nextHeaders, applicableCustomFields));
      setOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read the selected file";
      reset();
      toast.error(message);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      return;
    }

    setIsUploading(true);
    setResult(null);

    // Determine the contact type - use contactType first, fall back to importRole
    const effectiveContactType = contactType || importRole || "customer";

    try {
      const response = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows,
          mapping,
          // Pass the page context as contactType
          contactType: effectiveContactType,
          // Keep importRole for backward compatibility
          importRole: effectiveContactType,
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
          `${payload.imported ?? 0} contact(s) imported with ${payload.failed} issue(s).`,
        );
      } else {
        toast.success(
          `${payload.imported ?? 0} contact(s) imported.`,
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

  // Determine the contact type label for display
  const contactTypeLabel = getContactTypeLabel(contactType || importRole);

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
        data-testid="import-contacts-btn"
        onClick={openFilePicker}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import {contactTypeLabel !== "Contact" ? contactTypeLabel : "Contacts"}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import {contactTypeLabel} Contacts</DialogTitle>
            <DialogDescription>
              {contactType
                ? `This import will automatically save all records as "${contactTypeLabel}" contacts. `
                : ""}
              Review the selected CSV or Excel file, map the columns, and import.
              All rows with at least one non-empty value will be imported. Custom
              fields are matched from their labels or column headers.
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
                    Match your uploaded columns to standard contact fields and custom fields.
                    Unsupported columns are safely preserved in custom data.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {allImportFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">{field.label}</p>
                        {field.isCustom && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-400 text-blue-600">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={mapping[field.key] ?? SKIP_VALUE}
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
                    All rows containing at least one non-empty value will be imported.
                  </p>
                  {contactType ? (
                    <div className="text-xs text-muted-foreground mt-1">
                      All imported records will be saved with contact type: <Badge variant="outline" className="ml-1">{contactTypeLabel}</Badge>
                    </div>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Custom Fields</TableHead>
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
                            <EmailLink value={row.email} fallback="N/A" />
                          </TableCell>
                          <TableCell>
                            <WhatsAppLink value={row.phone} fallback="N/A" />
                          </TableCell>
                          <TableCell>
                            {row.customFields && row.customFields.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {row.customFields.map((cf, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px]">
                                    {cf.name}: {cf.value}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>{row.status || "N/A"}</TableCell>
                          <TableCell>
                            {row.valid ? (
                              <span className="text-green-600">Ready</span>
                            ) : (
                              <span className="text-yellow-600">Empty row</span>
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
                  `Import ${contactTypeLabel} Contacts`
                )}
              </Button>
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
                      {result.failed} row(s) failed due to database errors
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
                      {summary.updatedRows !== undefined && summary.updatedRows > 0 && (
                        <div>
                          <span className="text-muted-foreground">Updated:</span>{" "}
                          <span className="font-medium text-blue-600">{summary.updatedRows}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Skipped (Empty):</span>{" "}
                        <span className="font-medium text-yellow-600">{summary.skippedEmptyRows}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Failed (DB Errors):</span>{" "}
                        <span className="font-medium text-red-600">{summary.failedRows}</span>
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
                    {summary.unsupportedColumns && summary.unsupportedColumns.length > 0 ? (
                      <div className="mt-2">
                        <span className="text-xs text-destructive">Unsupported columns (not imported): </span>
                        <span className="text-xs">{summary.unsupportedColumns.join(", ")}</span>
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
