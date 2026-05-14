"use client";
import { Button } from "@/components/ui/button";
import { EmailLink } from "@/components/ui/contact-link";
import { Input } from "@/components/ui/input";
import { SearchIcon, UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import useDebounce from "@/hooks/useDebounce";
import { searchContacts, ContactSearchItem } from "@/actions/crm/contacts/search-contacts";
import { getQuickInputMemory } from "@/actions/crm/quick-input/get-quick-input-memory";
import { getQuickOpportunityFormOptions } from "@/actions/crm/quick-input/get-quick-opportunity-form-options";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewContactForm } from "../crm/contacts/components/NewContactForm";
import { NewOpportunityForm } from "../crm/opportunities/components/NewOpportunityForm";
import { getContactFormOptions } from "@/actions/crm/contacts/get-contact-form-options";
import type { UnifiedPersonFormValues } from "@/components/crm/unified-person-form";
import {
  buildQuickContactValues,
  buildQuickSuggestions,
  loadQuickMemory,
  rememberQuickValues,
  type QuickDbMemory,
  type QuickMemory,
  type QuickSuggestion,
} from "@/lib/crm/quick-input-engine";
import { extractOpportunitySignals } from "@/lib/smart-contact-input";

function hasEmailInput(value: string) {
  return /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+/i.test(value);
}

function hasLocationInput(value: string) {
  return /\b(?:address|city|state|country|zip|postal|india|usa|united states|dallas|houston|texas|indore|delhi|mumbai|pune|bhopal)\b/i.test(value);
}

function hasRoleInput(value: string) {
  return /\b(?:role|agent|customer|client|partner|vendor|other)\b/i.test(value);
}

function normalizeAmount(value: string, unit = "") {
  const amount = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return "";

  const normalizedUnit = unit.toLowerCase();
  if (["lakh", "lac"].includes(normalizedUnit)) return String(Math.round(amount * 100000));
  if (["cr", "crore"].includes(normalizedUnit)) return String(Math.round(amount * 10000000));
  if (["grand", "k"].includes(normalizedUnit)) return String(Math.round(amount * 1000));
  if (["m", "million"].includes(normalizedUnit)) return String(Math.round(amount * 1000000));

  return String(amount);
}

function extractAmountByLabels(input: string, labels: string[]) {
  const labelPattern = labels.map((label) => label.replace(/\s+/g, "\\s+")).join("|");
  const unitPattern = "(lakh|lac|grand|k|m|million|cr|crore)?";
  const afterLabel = new RegExp(
    `\\b(?:${labelPattern})\\s*[:\\-]?\\s*\\$?\\s*([\\d,]+(?:\\.\\d+)?)\\s*${unitPattern}\\b`,
    "i",
  );
  const beforeLabel = new RegExp(
    `\\b\\$?\\s*([\\d,]+(?:\\.\\d+)?)\\s*${unitPattern}\\s*(?:${labelPattern})\\b`,
    "i",
  );
  const match = input.match(afterLabel) ?? input.match(beforeLabel);

  return match ? normalizeAmount(match[1], match[2] ?? "") : "";
}

function matchDetectedProducts(productNames: string[], products: { name: string }[] = []) {
  return productNames.flatMap((name) => {
    const normalizedName = name.toLowerCase();
    const product = products.find((item) => {
      const normalizedProduct = item.name.toLowerCase();
      return normalizedProduct === normalizedName ||
        normalizedProduct.includes(normalizedName) ||
        normalizedName.includes(normalizedProduct);
    });

    return product ? [product.name] : [];
  });
}

function buildSearchContactInitialValues(
  input: string,
  options: Awaited<ReturnType<typeof getContactFormOptions>>,
): Partial<UnifiedPersonFormValues> {
  const parsed = buildQuickContactValues(input, {
    accounts: options.accounts,
    contactTypes: options.contactTypes,
    leadSources: options.leadSources,
    leadStatuses: options.leadStatuses,
    leadTypes: options.leadTypes,
    assignedTo: "",
  });
  const signals = extractOpportunitySignals(input);
  const detectedProducts = matchDetectedProducts(signals.products, options.products);
  const detectedBudget = extractAmountByLabels(input, ["budget", "premium", "monthly"]);
  const detectedFaceAmount =
    extractAmountByLabels(input, ["face amount", "coverage", "cover", "policy"]) ||
    (!detectedBudget ? signals.budget : "");
  const hasOpportunityValues =
    detectedProducts.length > 0 || Boolean(detectedBudget) || Boolean(detectedFaceAmount);

  return {
    ...parsed,
    serial: "",
    email: hasEmailInput(input) ? parsed.email ?? "" : "",
    personal_email: hasEmailInput(input) ? parsed.personal_email ?? "" : "",
    country: hasLocationInput(input) ? parsed.country ?? "" : "",
    role: hasRoleInput(input) ? parsed.role ?? "" : "",
    contact_type_id: "",
    lead_status_id: "",
    lead_type_id: "",
    assigned_to: "",
    status: null,
    opportunity_enabled: hasOpportunityValues,
    opportunity_products: detectedProducts,
    opportunity_budget: detectedBudget,
    opportunity_premium: detectedFaceAmount,
    opportunity_name: "",
    opportunity_stage_id: "",
    opportunity_description: "",
  };
}

const FulltextSearch = () => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactSearchItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [formOptions, setFormOptions] = useState<Awaited<ReturnType<typeof getContactFormOptions>> | null>(null);
  const [opportunityOptions, setOpportunityOptions] =
    useState<Awaited<ReturnType<typeof getQuickOpportunityFormOptions>> | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<UnifiedPersonFormValues> | undefined>();
  const [opportunityInitialValues, setOpportunityInitialValues] =
    useState<Parameters<typeof NewOpportunityForm>[0]["initialValues"]>();
  const [localMemory, setLocalMemory] = useState<QuickMemory>(() => loadQuickMemory());
  const [dbMemory, setDbMemory] = useState<QuickDbMemory>({});
  const [assignedUserId, setAssignedUserId] = useState("");

  const router = useRouter();
  const debouncedSearch = useDebounce(search, 300);
  const visibleResults = debouncedSearch.length >= 2 ? results : [];
  const parsedValues = useMemo(
    () =>
      buildQuickContactValues(search, {
        accounts: formOptions?.accounts,
        contactTypes: formOptions?.contactTypes,
        leadSources: formOptions?.leadSources,
        leadStatuses: formOptions?.leadStatuses,
        leadTypes: formOptions?.leadTypes,
        assignedTo: assignedUserId,
      }),
    [assignedUserId, formOptions, search],
  );
  const quickSuggestions = useMemo(
    () => buildQuickSuggestions(search, parsedValues, localMemory, dbMemory),
    [dbMemory, localMemory, parsedValues, search],
  );

  useEffect(() => {
    queueMicrotask(() => setLocalMemory(loadQuickMemory()));

    getQuickInputMemory()
      .then(setDbMemory)
      .catch(() => setDbMemory({}));
  }, []);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      return;
    }

    startTransition(async () => {
      const data = await searchContacts({
        search: debouncedSearch,
        take: 5,
      });
      setResults(data);
    });
  }, [debouncedSearch]);

  const handleSearch = async () => {
    router.push(`/fulltext-search?q=${search}`);
    setSearch("");
    setOpen(false);
  };

  const handleSelect = (contactId: string) => {
    router.push(`/crm/contacts/${contactId}`);
    setSearch("");
    setOpen(false);
  };

  const applySuggestion = (suggestion: QuickSuggestion) => {
    rememberQuickValues({ [suggestion.field]: suggestion.value });
    setLocalMemory(loadQuickMemory());

    if (suggestion.field === "emails") {
      setSearch(suggestion.value);
      return;
    }

    const suffixByField: Partial<Record<QuickSuggestion["field"], string>> = {
      names: suggestion.value,
      companies: `company: ${suggestion.value}`,
      cities: `city: ${suggestion.value}`,
      dealValues: `budget: ${suggestion.value}`,
      sources: `source: ${suggestion.value}`,
      agentNumbers: `agent: ${suggestion.value}`,
    };

    const suffix = suffixByField[suggestion.field] ?? suggestion.value;
    setSearch((current) => [current, suffix].filter(Boolean).join(" "));
  };

  const openAddContact = async () => {
    try {
      const options = await getContactFormOptions();
      const assignedTo = "";
      const parsedInitialValues = buildSearchContactInitialValues(search, options);

      setFormOptions(options);
      setInitialValues(parsedInitialValues);
      setAssignedUserId(assignedTo);
    } catch {
      const parsedFallbackValues = buildQuickContactValues(search);
      setFormOptions({
        accounts: [],
        contactTypes: [],
        leadSources: [],
        leadStatuses: [],
        leadTypes: [],
        products: [],
      });
      setInitialValues({
        ...parsedFallbackValues,
        serial: "",
        contact_type_id: "",
        lead_status_id: "",
        lead_type_id: "",
        assigned_to: "",
        role: hasRoleInput(search) ? parsedFallbackValues.role ?? "" : "",
        country: hasLocationInput(search) ? parsedFallbackValues.country ?? "" : "",
        status: null,
      });
    }
    setDialogOpen(true);
    setOpen(false);
  };

  const handleCreated = async (_contact: unknown, submittedData: UnifiedPersonFormValues) => {
    const contactId =
      typeof _contact === "object" && _contact && "id" in _contact
        ? String((_contact as { id?: string }).id ?? "")
        : "";
    const values = submittedData;
    const loadedOpportunityOptions = await getQuickOpportunityFormOptions();
    const contactOption = {
      id: contactId,
      serial: values.serial ?? null,
      first_name: values.first_name ?? "",
      last_name: values.last_name ?? "",
      accountsIDs: values.assigned_account ?? null,
    };

    setLocalMemory(
      rememberQuickValues({
        names: [values.first_name, values.last_name].filter(Boolean).join(" "),
        companies: values.company,
        cities: values.city,
        dealValues: values.opportunity_budget || values.opportunity_premium,
        sources: values.campaign ?? "",
        agentNumbers: values.serial,
        emails: values.email,
      }),
    );

    setOpportunityOptions({
      ...loadedOpportunityOptions,
      contacts: contactId && !loadedOpportunityOptions.contacts.some((item: { id: string }) => item.id === contactId)
        ? [contactOption, ...loadedOpportunityOptions.contacts]
        : loadedOpportunityOptions.contacts,
    });
    setOpportunityInitialValues({
      name: [values.first_name, values.last_name, "Opportunity"].filter(Boolean).join(" "),
      account: values.assigned_account ?? "",
      contact: contactId,
      category: values.opportunity_products ?? [],
      budget: values.opportunity_budget ?? "",
      expected_revenue: values.opportunity_premium ?? "",
      sales_stage: dbMemory.defaultSalesStageId ?? "",
      type: dbMemory.defaultOpportunityTypeId ?? "",
      currency: dbMemory.defaultCurrency || "USD",
      description: "",
      next_step: "",
      campaign: "",
      assigned_to: assignedUserId,
    });
    setOpportunityDialogOpen(true);
    toast.success("Contact saved. Opportunity form is ready.");
  };

  return (
    <div className="flex min-w-0 w-full flex-1 items-center space-x-2 relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1 flex items-center relative">
            <Input
              type="text"
              className="min-w-0 flex-1"
              placeholder={"Search something ..."}
              value={search}
              onChange={(e) => {
                const value = e.target.value;
                setSearch(value);
                if (!open) setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
            {isPending && search.length >= 2 && (
              <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {search.trim().length > 0 && (
                <div className="border-b p-3">
                  <Button
                    size="sm"
                    onClick={openAddContact}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create Contact + Opportunity
                  </Button>
                  {quickSuggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quickSuggestions.slice(0, 8).map((suggestion) => (
                        <button
                          key={`${suggestion.field}-${suggestion.value}`}
                          type="button"
                          onClick={() => applySuggestion(suggestion)}
                          className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {suggestion.value}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {visibleResults.length > 0 ? (
                <CommandGroup heading="Contacts">
                  {visibleResults.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={contact.id}
                      onSelect={handleSelect}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {contact.first_name} {contact.last_name}
                        </span>
                        {contact.email && (
                          <span className="text-xs text-muted-foreground">
                            <EmailLink value={contact.email} className="text-xs" />
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                !isPending && search.length >= 2 && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">No contacts found.</p>
                  </div>
                )
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button onClick={handleSearch} className="shrink-0 gap-2">
        <span className="hidden sm:flex">Search</span>
        <SearchIcon className="h-4 w-4" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Add Contact + Opportunity</DialogTitle>
            <DialogDescription>
              Deterministic extraction fills the contact. Saving also prepares a new opportunity.
            </DialogDescription>
          </DialogHeader>
          {formOptions && (
            <NewContactForm 
              accounts={formOptions.accounts}
              contactTypes={formOptions.contactTypes}
              leadSources={formOptions.leadSources}
              leadStatuses={formOptions.leadStatuses}
              leadTypes={formOptions.leadTypes}
              products={formOptions.products}
              onFinish={() => {
                setDialogOpen(false);
                router.refresh();
              }}
              onCreated={handleCreated}
              initialValues={initialValues}
              quickOpportunitySection
              quickEmptyDefaults
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={opportunityDialogOpen} onOpenChange={setOpportunityDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Add Opportunity</DialogTitle>
            <DialogDescription>
              Contact is selected from the record you just created.
            </DialogDescription>
          </DialogHeader>
          {opportunityOptions && (
            <NewOpportunityForm
              accounts={opportunityOptions.accounts}
              contacts={opportunityOptions.contacts}
              salesType={opportunityOptions.salesType}
              saleStages={opportunityOptions.saleStages}
              campaigns={opportunityOptions.campaigns}
              currencies={opportunityOptions.currencies.map((currency) => ({
                code: currency.code,
                name: currency.name,
                symbol: currency.symbol,
              }))}
              categoryOptions={opportunityOptions.categoryOptions}
              initialValues={opportunityInitialValues}
              onDialogClose={() => {
                setOpportunityDialogOpen(false);
                setSearch("");
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FulltextSearch;
