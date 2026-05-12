import {
  buildSmartContactInitialValues,
  extractOpportunitySignals,
} from "@/lib/smart-contact-input";
import type { UnifiedPersonFormValues } from "@/components/crm/unified-person-form";

export type QuickMemoryField =
  | "names"
  | "companies"
  | "cities"
  | "dealValues"
  | "sources"
  | "agentNumbers"
  | "emails";

export type QuickMemoryValue = {
  value: string;
  count: number;
  updatedAt: number;
};

export type QuickMemory = Record<QuickMemoryField, QuickMemoryValue[]>;

export type QuickDbMemory = Partial<Record<QuickMemoryField, string[]>> & {
  defaultCurrency?: string;
  defaultSalesStageId?: string;
  defaultOpportunityTypeId?: string;
  defaultBudget?: string;
};

export type QuickSuggestion = {
  field: QuickMemoryField;
  value: string;
  source: "local" | "db" | "extracted" | "default";
};

const STORAGE_KEY = "nextcrm.quickInputMemory.v1";
const MEMORY_FIELDS: QuickMemoryField[] = [
  "names",
  "companies",
  "cities",
  "dealValues",
  "sources",
  "agentNumbers",
  "emails",
];

const EMPTY_MEMORY: QuickMemory = {
  names: [],
  companies: [],
  cities: [],
  dealValues: [],
  sources: [],
  agentNumbers: [],
  emails: [],
};

function now() {
  return Date.now();
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniquePush(items: QuickSuggestion[], seen: Set<string>, suggestion: QuickSuggestion) {
  const value = clean(suggestion.value);
  if (!value) return;

  const key = `${suggestion.field}:${value.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push({ ...suggestion, value });
}

function readMemoryValue(value: unknown): QuickMemory {
  if (!value || typeof value !== "object") return EMPTY_MEMORY;

  return MEMORY_FIELDS.reduce<QuickMemory>((memory, field) => {
    const rawItems = (value as Partial<QuickMemory>)[field];
    memory[field] = Array.isArray(rawItems)
      ? rawItems
          .map((item) => ({
            value: clean(item?.value),
            count: Number(item?.count || 0),
            updatedAt: Number(item?.updatedAt || 0),
          }))
          .filter((item) => item.value)
      : [];
    return memory;
  }, { ...EMPTY_MEMORY });
}

export function loadQuickMemory(): QuickMemory {
  if (typeof window === "undefined") return EMPTY_MEMORY;

  try {
    return readMemoryValue(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return EMPTY_MEMORY;
  }
}

function writeQuickMemory(memory: QuickMemory) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export function rememberQuickValues(values: Partial<Record<QuickMemoryField, string | number | null | undefined>>) {
  const memory = loadQuickMemory();
  const timestamp = now();

  for (const field of MEMORY_FIELDS) {
    const value = clean(values[field]);
    if (!value) continue;

    const existing = memory[field].find((item) => item.value.toLowerCase() === value.toLowerCase());
    if (existing) {
      existing.count += 1;
      existing.updatedAt = timestamp;
    } else {
      memory[field].push({ value, count: 1, updatedAt: timestamp });
    }

    memory[field] = memory[field]
      .sort((a, b) => b.count - a.count || b.updatedAt - a.updatedAt)
      .slice(0, 25);
  }

  writeQuickMemory(memory);
  return memory;
}

export function buildQuickContactValues(
  input: string,
  options: Parameters<typeof buildSmartContactInitialValues>[1] = {},
): Partial<UnifiedPersonFormValues> {
  return buildSmartContactInitialValues(input, options);
}

export function buildQuickSuggestions(
  input: string,
  parsed: Partial<UnifiedPersonFormValues>,
  localMemory: QuickMemory,
  dbMemory: QuickDbMemory = {},
): QuickSuggestion[] {
  const prefix = input.trim().toLowerCase();
  const suggestions: QuickSuggestion[] = [];
  const seen = new Set<string>();

  for (const field of MEMORY_FIELDS) {
    localMemory[field]
      .filter((item) => !prefix || item.value.toLowerCase().startsWith(prefix))
      .slice(0, 5)
      .forEach((item) => uniquePush(suggestions, seen, { field, value: item.value, source: "local" }));
  }

  for (const field of MEMORY_FIELDS) {
    (dbMemory[field] ?? [])
      .filter((value) => !prefix || value.toLowerCase().startsWith(prefix))
      .slice(0, 5)
      .forEach((value) => uniquePush(suggestions, seen, { field, value, source: "db" }));
  }

  uniquePush(suggestions, seen, {
    field: "names",
    value: [parsed.first_name, parsed.last_name].filter(Boolean).join(" "),
    source: "extracted",
  });
  uniquePush(suggestions, seen, { field: "companies", value: parsed.company ?? "", source: "extracted" });
  uniquePush(suggestions, seen, { field: "cities", value: parsed.city ?? "", source: "extracted" });
  uniquePush(suggestions, seen, { field: "emails", value: parsed.email ?? "", source: "extracted" });

  uniquePush(suggestions, seen, { field: "dealValues", value: dbMemory.defaultBudget ?? "1000", source: "default" });
  uniquePush(suggestions, seen, { field: "sources", value: "Inbound", source: "default" });

  return suggestions.slice(0, 12);
}

export function buildQuickOpportunityDefaults(args: {
  contactId?: string;
  contactValues: Partial<UnifiedPersonFormValues>;
  dbMemory?: QuickDbMemory;
  assignedTo?: string;
}) {
  const fullName = [args.contactValues.first_name, args.contactValues.last_name].filter(Boolean).join(" ").trim();
  const signals = extractOpportunitySignals(args.contactValues.description ?? "");
  const budget = clean(signals.budget) || clean(args.dbMemory?.defaultBudget) || "1000";
  const revenue = String(Math.round(Number(budget || 0) * 0.5));
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 7);

  return {
    name: signals.intent
      ? `${signals.intent} - ${fullName || args.contactValues.email || "New Contact"}`
      : `Lead - ${fullName || args.contactValues.email || "New Contact"}`,
    close_date: closeDate,
    budget,
    expected_revenue: revenue,
    sales_stage: args.dbMemory?.defaultSalesStageId ?? "",
    type: args.dbMemory?.defaultOpportunityTypeId ?? "",
    currency: signals.currency || args.dbMemory?.defaultCurrency || "USD",
    contact: args.contactId ?? "",
    assigned_to: args.assignedTo ?? args.contactValues.assigned_to ?? "",
    description: args.contactValues.description ?? "",
    category: signals.products,
    next_step: signals.nextStep,
  };
}
