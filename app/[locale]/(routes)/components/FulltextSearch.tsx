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
import { searchUsers } from "@/actions/user/search-users";
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
  buildQuickOpportunityDefaults,
  buildQuickSuggestions,
  loadQuickMemory,
  rememberQuickValues,
  type QuickDbMemory,
  type QuickMemory,
  type QuickSuggestion,
} from "@/lib/crm/quick-input-engine";

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
      const [options, users] = await Promise.all([
        getContactFormOptions(),
        searchUsers({ take: 1 }),
      ]);
      const assignedTo = users.users[0]?.id ?? "";

      const parsedInitialValues = buildQuickContactValues(search, {
        accounts: options.accounts,
        contactTypes: options.contactTypes,
        leadSources: options.leadSources,
        leadStatuses: options.leadStatuses,
        leadTypes: options.leadTypes,
        assignedTo,
      });

      setFormOptions(options);
      setInitialValues(parsedInitialValues);
      setAssignedUserId(assignedTo);
    } catch {
      setFormOptions({
        accounts: [],
        contactTypes: [],
        leadSources: [],
        leadStatuses: [],
        leadTypes: [],
        products: [],
      });
      setInitialValues(buildQuickContactValues(search));
    }
    setDialogOpen(true);
    setOpen(false);
  };

  const handleCreated = async (contact: unknown, submittedData: UnifiedPersonFormValues) => {
    const contactId = typeof contact === "object" && contact && "id" in contact
      ? String((contact as { id?: string }).id ?? "")
      : "";
    const values = submittedData;
    const opportunityDefaults = buildQuickOpportunityDefaults({
      contactId,
      contactValues: values,
      dbMemory,
      assignedTo: assignedUserId,
    });
    const loadedOpportunityOptions = await getQuickOpportunityFormOptions();
    const contactOption = {
      id: contactId,
      first_name: values.first_name ?? "",
      last_name: values.last_name ?? "",
      accountsIDs: values.assigned_account ?? null,
    };

    setLocalMemory(
      rememberQuickValues({
        names: [values.first_name, values.last_name].filter(Boolean).join(" "),
        companies: values.company,
        cities: values.city,
        dealValues: opportunityDefaults.budget,
        sources: values.campaign || "Inbound",
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
      ...opportunityDefaults,
      account: values.assigned_account ?? "",
      contact: contactId,
      category: values.opportunity_products ?? opportunityDefaults.category,
      budget: values.opportunity_budget || opportunityDefaults.budget,
      description: values.description ?? search,
    });
    setOpportunityDialogOpen(true);
    toast.success("Contact created. Opportunity form is ready.");
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
