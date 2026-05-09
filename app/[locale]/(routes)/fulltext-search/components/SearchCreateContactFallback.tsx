"use client";

import { useEffect, useState } from "react";
import { Plus, UserRoundPlus } from "lucide-react";

import { getContactFormOptions } from "@/actions/crm/contacts/get-contact-form-options";
import { NewContactForm } from "@/app/[locale]/(routes)/crm/contacts/components/NewContactForm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildSmartContactInitialValues } from "@/lib/smart-contact-input";
import type { UnifiedPersonFormValues } from "@/components/crm/unified-person-form";

export function SearchCreateContactFallback({ query }: { query: string }) {
  const [open, setOpen] = useState(false);
  const [formOptions, setFormOptions] = useState<Awaited<ReturnType<typeof getContactFormOptions>> | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<UnifiedPersonFormValues> | undefined>();

  useEffect(() => {
    if (!open) return;
    getContactFormOptions()
      .then((options) => {
        setFormOptions(options);
        setInitialValues(
          buildSmartContactInitialValues(query, {
            accounts: options.accounts,
            contactTypes: options.contactTypes,
            leadSources: options.leadSources,
            leadStatuses: options.leadStatuses,
            leadTypes: options.leadTypes,
          }),
        );
      })
      .catch(() => {
        setFormOptions({
          accounts: [],
          contactTypes: [],
          leadSources: [],
          leadStatuses: [],
          leadTypes: [],
          products: [],
        });
        setInitialValues(buildSmartContactInitialValues(query));
      });
  }, [open, query]);

  return (
    <>
      <div className="rounded-lg border border-dashed p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserRoundPlus className="h-4 w-4" />
              No exact match found
            </div>
            <p className="text-sm text-muted-foreground">
              Create a contact from this search and prefill what can be extracted from the query.
            </p>
          </div>
          <Button type="button" onClick={() => setOpen(true)} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Create contact
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto md:max-w-[771px]">
          <SheetHeader>
            <SheetTitle>Create Contact</SheetTitle>
            <SheetDescription>
              Prefilled from search: {query}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {formOptions && (
              <NewContactForm
                accounts={formOptions.accounts}
                contactTypes={formOptions.contactTypes}
                leadSources={formOptions.leadSources}
                leadStatuses={formOptions.leadStatuses}
                leadTypes={formOptions.leadTypes}
                products={formOptions.products}
                initialValues={{
                  ...initialValues,
                }}
                onFinish={() => setOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
