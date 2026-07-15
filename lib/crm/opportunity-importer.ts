/**
 * Dynamic Opportunity Import Engine
 *
 * Reuses the shared import engine from import-engine.ts for:
 * - Header normalization
 * - Field mapping (model fields + custom fields)
 * - Row mapping
 * - Custom field extraction
 *
 * Provides opportunity-specific logic:
 * - Standard field aliases for Opportunity model
 * - Row validation (no business fields mandatory, skip empty rows)
 * - Bulk insert with error isolation
 * - Reference resolution (accounts, users, sales stages, types, campaigns, currencies)
 * - Detailed import summary
 */
import { prismadb } from "@/lib/prisma";
import {
  type ImportRow,
  type ImportFieldMapping,
  type ImportValidationError,
  type ImportSummary,
  type MappedRow,
  buildModelFieldLookup,
  buildFieldMapping,
  mapRow,
  extractCustomFields,
  sanitizeCustomFieldValues,
  isEmptyRow,
} from "@/lib/crm/import-engine";
import {
  type CustomFieldDefinition,
} from "@/lib/custom-fields";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpportunityImportOptions {
  userId: string;
  importBatchId?: string;
}

export interface BulkInsertResult {
  imported: number;
  errors: ImportValidationError[];
}

// ---------------------------------------------------------------------------
// Standard field aliases (normalized -> model field name)
// ---------------------------------------------------------------------------

const STANDARD_FIELD_ALIASES: Record<string, string[]> = {
  name: [
    "opportunity name",
    "opportunityname",
    "deal name",
    "dealname",
    "opportunity",
    "deal",
    "title",
    "ad name",
    "adname",
  ],
  account: [
    "account",
    "account name",
    "accountname",
    "assigned account",
    "assignedaccount",
    "company",
    "company name",
    "companyname",
    "organization",
    "organisation",
    "client",
    "client name",
    "clientname",
  ],
  assigned_to: [
    "assigned to",
    "assignedto",
    "owner",
    "user",
    "assignee",
    "sales person",
    "salesperson",
    "responsible",
  ],
  budget: [
    "budget",
    "value",
    "deal value",
    "dealvalue",
    "amount",
    "opportunity value",
    "opportunityvalue",
    "expected revenue",
    "expectedrevenue",
    "revenue",
    "price",
    "project value",
    "projectvalue",
    "contract value",
    "contractvalue",
  ],
  close_date: [
    "close date",
    "closedate",
    "closing date",
    "closingdate",
    "expected close",
    "expectedclose",
    "expected close date",
    "expectedclosedate",
    "estimated close",
    "estimatedclose",
    "estimated closing",
    "estimatedclosing",
    "target date",
    "targetdate",
    "deadline",
  ],
  sales_stage: [
    "sales stage",
    "salesstage",
    "stage",
    "pipeline stage",
    "pipelinestage",
    "deal stage",
    "dealstage",
    "opportunity stage",
    "opportunitystage",
    "status",
    "lead status",
    "leadstatus",
  ],
  type: [
    "type",
    "opportunity type",
    "opportunitytype",
    "deal type",
    "dealtype",
    "category",
    "sale type",
    "saletype",
  ],
  description: [
    "description",
    "notes",
    "note",
    "details",
    "comments",
    "remarks",
    "additional info",
    "additionalinfo",
  ],
  next_step: [
    "next step",
    "nextstep",
    "next action",
    "nextaction",
    "follow up",
    "followup",
  ],
  campaign: [
    "campaign",
    "campaign name",
    "campaignname",
    "source campaign",
    "sourcecampaign",
    "campaign id",
    "campaignid",
  ],
  contact: [
    "contact",
    "contact name",
    "contactname",
    "primary contact",
    "primarycontact",
    "client name",
    "clientname",
    "customer name",
    "customername",
  ],
  currency: [
    "currency",
    "currency code",
    "currencycode",
    "currency name",
    "currencyname",
  ],
  expected_revenue: [
    "expected revenue",
    "expectedrevenue",
    "forecasted revenue",
    "forecastedrevenue",
    "projected revenue",
    "projectedrevenue",
  ],
  clientName: [
    "client name",
    "clientname",
    "customer",
    "customer name",
    "customername",
    "prospect name",
    "prospectname",
  ],
  category: [
    "category",
    "product",
    "product name",
    "productname",
    "service",
    "service type",
    "servicetype",
    "line of business",
    "lineofbusiness",
  ],
};

// ---------------------------------------------------------------------------
// Build model field lookup for Opportunities
// ---------------------------------------------------------------------------

const OPPORTUNITY_EXCLUDED_FIELDS = new Set<string>([
  "id",
  "v",
  "__v",
  "createdAt",
  "createdBy",
  "created_by",
  "created_on",
  "updatedAt",
  "updatedBy",
  "deletedAt",
  "deletedBy",
  "last_activity",
  "last_activity_by",
  "custom_fields_data",
  "snapshot_rate",
  "contacts",
  "documents",
  "lineItems",
  "assigned_account",
  "assigned_to_user",
  "assigned_campaings",
  "created_by_user",
  "assigned_currency",
  "assigned_sales_stage",
  "assigned_type",
]);

let _opportunityFieldLookup: Map<string, string> | null = null;

function getOpportunityFieldLookup(): Map<string, string> {
  if (!_opportunityFieldLookup) {
    _opportunityFieldLookup = buildModelFieldLookup(
      "crm_Opportunities",
      STANDARD_FIELD_ALIASES,
      OPPORTUNITY_EXCLUDED_FIELDS,
    );
  }
  return _opportunityFieldLookup;
}

// ---------------------------------------------------------------------------
// Find a matching field for an opportunity header
// ---------------------------------------------------------------------------

/**
 * Find a matching opportunity model field for an Excel header.
 * "Opportunity Name" → "name"
 * "Deal Value" → "budget"
 * "Pipeline Stage" → "sales_stage"
 * "Expected Close" → "close_date"
 */
export function findMatchingOpportunityField(header: string): string | null {
  const lookup = getOpportunityFieldLookup();
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
  return lookup.get(normalized) ?? null;
}

// ---------------------------------------------------------------------------
// Build field mapping for opportunities
// ---------------------------------------------------------------------------

/**
 * Build a mapping of all Excel headers to either opportunity model fields or custom fields.
 */
export function buildOpportunityFieldMapping(
  headers: string[],
  customFieldDefinitions: CustomFieldDefinition[],
): ImportFieldMapping {
  return buildFieldMapping(
    headers,
    getOpportunityFieldLookup(),
    customFieldDefinitions,
  );
}

// ---------------------------------------------------------------------------
// Map a single opportunity row
// ---------------------------------------------------------------------------

/**
 * Map a single Excel row to opportunity model values, custom field values, and unknown values.
 */
export function mapOpportunityRow(
  row: ImportRow,
  mapping: ImportFieldMapping,
): MappedRow {
  return mapRow(row, mapping);
}

// ---------------------------------------------------------------------------
// Validate an opportunity row
// ---------------------------------------------------------------------------

/**
 * Validate an opportunity row.
 * - No business fields are mandatory
 * - Only completely empty rows are skipped
 * - Returns validation errors for empty rows
 */
export function validateOpportunity(
  mappedRow: MappedRow,
  rowNumber: number,
): { valid: boolean; errors: ImportValidationError[] } {
  const errors: ImportValidationError[] = [];

  // Check if the row has any model values at all
  const hasAnyValue = Object.keys(mappedRow.modelValues).length > 0;
  if (!hasAnyValue) {
    errors.push({
      row: rowNumber,
      field: "general",
      reason: "Row is completely empty. No data to import.",
      identifier: null,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Bulk import opportunities
// ---------------------------------------------------------------------------

/**
 * Bulk import mapped opportunities into the database.
 * Each row is processed individually so that one failure doesn't stop the batch.
 */
export async function bulkImportOpportunities(
  mappedRows: Array<{
    row: ImportRow;
    mapped: MappedRow;
    rowNumber: number;
  }>,
  options: OpportunityImportOptions,
  customFieldDefinitions: CustomFieldDefinition[],
): Promise<BulkInsertResult> {
  const {
    userId,
    importBatchId = Date.now().toString(36).toUpperCase(),
  } = options;

  // Collect unique lookup values for resolution
  const uniqueUsers = new Set<string>();
  const uniqueAccounts = new Set<string>();
  const uniqueSalesStages = new Set<string>();
  const uniqueTypes = new Set<string>();
  const uniqueCampaigns = new Set<string>();
  const uniqueCurrencies = new Set<string>();
  const uniqueContacts = new Set<string>();

  for (const { mapped } of mappedRows) {
    if (mapped.modelValues.assigned_to) uniqueUsers.add(mapped.modelValues.assigned_to);
    if (mapped.modelValues.account) uniqueAccounts.add(mapped.modelValues.account);
    if (mapped.modelValues.sales_stage) uniqueSalesStages.add(mapped.modelValues.sales_stage);
    if (mapped.modelValues.type) uniqueTypes.add(mapped.modelValues.type);
    if (mapped.modelValues.campaign) uniqueCampaigns.add(mapped.modelValues.campaign);
    if (mapped.modelValues.currency) uniqueCurrencies.add(mapped.modelValues.currency);
    if (mapped.modelValues.contact) uniqueContacts.add(mapped.modelValues.contact);
  }

  // Resolve lookup values
  const [users, accounts, salesStages, types, campaigns, currencies, contacts] = await Promise.all([
    uniqueUsers.size
      ? prismadb.users.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueUsers) } },
              { email: { in: Array.from(uniqueUsers) } },
              { name: { in: Array.from(uniqueUsers) } },
            ],
          },
          select: { id: true, email: true, name: true },
        })
      : Promise.resolve([]),
    uniqueAccounts.size
      ? prismadb.crm_Accounts.findMany({
          where: {
            deletedAt: null,
            OR: [
              { id: { in: Array.from(uniqueAccounts) } },
              { name: { in: Array.from(uniqueAccounts) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueSalesStages.size
      ? prismadb.crm_Opportunities_Sales_Stages.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueSalesStages) } },
              { name: { in: Array.from(uniqueSalesStages) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueTypes.size
      ? prismadb.crm_Opportunities_Type.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueTypes) } },
              { name: { in: Array.from(uniqueTypes) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueCampaigns.size
      ? prismadb.crm_campaigns.findMany({
          where: {
            OR: [
              { id: { in: Array.from(uniqueCampaigns) } },
              { name: { in: Array.from(uniqueCampaigns) } },
            ],
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueCurrencies.size
      ? prismadb.currency.findMany({
          where: {
            OR: [
              { code: { in: Array.from(uniqueCurrencies) } },
              { name: { in: Array.from(uniqueCurrencies) } },
            ],
          },
          select: { code: true, name: true },
        })
      : Promise.resolve([]),
    uniqueContacts.size
      ? prismadb.crm_Contacts.findMany({
          where: {
            deletedAt: null,
            OR: [
              { id: { in: Array.from(uniqueContacts) } },
              { email: { in: Array.from(uniqueContacts) } },
              { first_name: { in: Array.from(uniqueContacts) } },
            ],
          },
          select: { id: true, email: true, first_name: true, last_name: true },
        })
      : Promise.resolve([]),
  ]);

  // Build lookup maps
  const userLookup = new Map<string, string>();
  const accountLookup = new Map<string, string>();
  const salesStageLookup = new Map<string, string>();
  const typeLookup = new Map<string, string>();
  const campaignLookup = new Map<string, string>();
  const currencyLookup = new Map<string, string>();
  const contactLookup = new Map<string, string>();

  users.forEach((u) => {
    userLookup.set(u.id, u.id);
    if (u.email) userLookup.set(u.email, u.id);
    if (u.name) userLookup.set(u.name, u.id);
  });
  accounts.forEach((a) => {
    accountLookup.set(a.id, a.id);
    accountLookup.set(a.name, a.id);
    accountLookup.set(a.name.trim().toLowerCase(), a.id);
  });
  salesStages.forEach((ss) => {
    salesStageLookup.set(ss.id, ss.id);
    salesStageLookup.set(ss.name, ss.id);
    salesStageLookup.set(ss.name.trim().toLowerCase(), ss.id);
  });
  types.forEach((t) => {
    typeLookup.set(t.id, t.id);
    typeLookup.set(t.name, t.id);
    typeLookup.set(t.name.trim().toLowerCase(), t.id);
  });
  campaigns.forEach((c) => {
    campaignLookup.set(c.id, c.id);
    campaignLookup.set(c.name, c.id);
    campaignLookup.set(c.name.trim().toLowerCase(), c.id);
  });
  currencies.forEach((c) => {
    currencyLookup.set(c.code, c.code);
    currencyLookup.set(c.name, c.code);
    currencyLookup.set(c.name.trim().toLowerCase(), c.code);
  });
  contacts.forEach((c) => {
    contactLookup.set(c.id, c.id);
    if (c.email) contactLookup.set(c.email, c.id);
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (fullName) contactLookup.set(fullName, c.id);
    if (c.first_name) contactLookup.set(c.first_name, c.id);
  });

  // Auto-create missing accounts
  const accountNamesSet = new Set(accounts.map((a) => a.name.trim().toLowerCase()));
  const missingAccountNames = Array.from(uniqueAccounts).filter(
    (name) => !accountNamesSet.has(name.trim().toLowerCase()) && !accountLookup.has(name.trim().toLowerCase()),
  );
  for (const accountName of missingAccountNames) {
    const account = await prismadb.crm_Accounts.create({
      data: {
        v: 0,
        name: accountName.trim(),
        status: "Active",
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true, name: true },
    });
    accountLookup.set(account.id, account.id);
    accountLookup.set(account.name, account.id);
    accountLookup.set(account.name.trim().toLowerCase(), account.id);
  }

  let imported = 0;
  const errors: ImportValidationError[] = [];

  for (const { row: rawRow, mapped, rowNumber } of mappedRows) {
    try {
      // Resolve references
      const resolvedAssignedTo = mapped.modelValues.assigned_to
        ? userLookup.get(mapped.modelValues.assigned_to) ?? userLookup.get(mapped.modelValues.assigned_to.trim().toLowerCase())
        : undefined;
      const resolvedAccount = mapped.modelValues.account
        ? accountLookup.get(mapped.modelValues.account) ?? accountLookup.get(mapped.modelValues.account.trim().toLowerCase())
        : undefined;
      const resolvedSalesStage = mapped.modelValues.sales_stage
        ? salesStageLookup.get(mapped.modelValues.sales_stage) ?? salesStageLookup.get(mapped.modelValues.sales_stage.trim().toLowerCase())
        : undefined;
      const resolvedType = mapped.modelValues.type
        ? typeLookup.get(mapped.modelValues.type) ?? typeLookup.get(mapped.modelValues.type.trim().toLowerCase())
        : undefined;
      const resolvedCampaign = mapped.modelValues.campaign
        ? campaignLookup.get(mapped.modelValues.campaign) ?? campaignLookup.get(mapped.modelValues.campaign.trim().toLowerCase())
        : undefined;
      const resolvedCurrency = mapped.modelValues.currency
        ? currencyLookup.get(mapped.modelValues.currency) ?? currencyLookup.get(mapped.modelValues.currency.trim().toLowerCase())
        : undefined;
      const resolvedContact = mapped.modelValues.contact
        ? contactLookup.get(mapped.modelValues.contact) ?? contactLookup.get(mapped.modelValues.contact.trim().toLowerCase())
        : undefined;

      // Parse numeric values
      let budget = 0;
      if (mapped.modelValues.budget) {
        const parsed = parseFloat(mapped.modelValues.budget.replace(/[^0-9.\-]/g, ""));
        if (!isNaN(parsed)) budget = parsed;
      }

      let expectedRevenue = 0;
      if (mapped.modelValues.expected_revenue) {
        const parsed = parseFloat(mapped.modelValues.expected_revenue.replace(/[^0-9.\-]/g, ""));
        if (!isNaN(parsed)) expectedRevenue = parsed;
      }

      // Parse close date
      let closeDate: Date | undefined;
      if (mapped.modelValues.close_date) {
        const parsed = new Date(mapped.modelValues.close_date);
        if (!isNaN(parsed.getTime())) closeDate = parsed;
      }

      // Handle custom fields
      const allCustomValues = extractCustomFields(mapped, customFieldDefinitions);
      const sanitizedCustomValues = sanitizeCustomFieldValues(allCustomValues, customFieldDefinitions);
      const customFieldsData = Object.keys(sanitizedCustomValues).length > 0
        ? sanitizedCustomValues
        : undefined;

      // Build opportunity payload
      const opportunityPayload = {
        v: 1,
        name: mapped.modelValues.name || `Imported Opportunity ${importBatchId}-${String(rowNumber).padStart(4, "0")}`,
        account: resolvedAccount,
        assigned_to: resolvedAssignedTo,
        budget: budget,
        expected_revenue: expectedRevenue,
        close_date: closeDate,
        sales_stage: resolvedSalesStage,
        type: resolvedType,
        campaign: resolvedCampaign,
        currency: resolvedCurrency,
        contact: resolvedContact,
        description: mapped.modelValues.description || undefined,
        next_step: mapped.modelValues.next_step || undefined,
        clientName: mapped.modelValues.clientName || undefined,
        category: mapped.modelValues.category || undefined,
        custom_fields_data: customFieldsData,
        createdBy: userId,
        updatedBy: userId,
      };

      await prismadb.crm_Opportunities.create({
        data: opportunityPayload as any,
        select: { id: true },
      });
      imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        field: "general",
        reason: error instanceof Error ? error.message : "Unknown error processing row",
        identifier: mapped.modelValues.name || null,
      });
    }
  }

  return { imported, errors };
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Main entry point for importing opportunities.
 * Returns a detailed summary of the import operation.
 */
export async function importOpportunities(
  rows: ImportRow[],
  options: OpportunityImportOptions,
  customFieldDefinitions: CustomFieldDefinition[],
): Promise<ImportSummary> {
  const allHeaders = Array.from(
    rows.reduce((headers, row) => {
      Object.keys(row).forEach((header) => {
        if (header.trim()) headers.add(header);
      });
      return headers;
    }, new Set<string>()),
  );

  // Build field mapping
  const mapping = buildOpportunityFieldMapping(allHeaders, customFieldDefinitions);

  // Map and validate each row
  const validRows: Array<{ row: ImportRow; mapped: MappedRow; rowNumber: number }> = [];
  const validationErrors: ImportValidationError[] = [];
  let skippedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // 1-indexed with header row

    // Skip completely empty rows
    if (isEmptyRow(rows[i])) {
      skippedRows++;
      continue;
    }

    const mapped = mapOpportunityRow(rows[i], mapping);
    const validation = validateOpportunity(mapped, rowNumber);

    if (validation.valid) {
      validRows.push({ row: rows[i], mapped, rowNumber });
    } else {
      validationErrors.push(...validation.errors);
    }
  }

  // Bulk insert valid rows
  const { imported, errors } = await bulkImportOpportunities(validRows, options, customFieldDefinitions);

  // Compile summary
  const mappedFields = Object.values(mapping.modelFields);
  const customFields = Object.values(mapping.customFields);

  return {
    totalRows: rows.length,
    importedRows: imported,
    skippedRows,
    validationErrors: [...validationErrors, ...errors],
    mappedFields: [...new Set(mappedFields)],
    customFields: [...new Set(customFields)],
    failedRows: validationErrors.length + errors.length,
  };
}