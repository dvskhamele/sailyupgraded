"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, UserRoundPlus } from "lucide-react";

import { getContactAccountOptions } from "@/actions/crm/contacts/get-contact-account-options";
import { NewContactForm } from "@/app/[locale]/(routes)/crm/contacts/components/NewContactForm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AccountOption = {
  id: string;
  name: string;
};

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseContactSeed(query: string) {
  const emailMatch = query.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = query.match(/(?:\+?\d[\d\s\-()]{6,}\d)/);

  const email = emailMatch?.[0] ?? "";
  const mobile_phone = phoneMatch?.[0]?.trim() ?? "";

  let cleaned = query
    .replace(email, " ")
    .replace(mobile_phone, " ")
    .replace(/\b(contact|lead|company|email|phone|mobile|deal|opportunity)\b/gi, " ")
    .replace(/[,:;|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let assigned_account = "";
  const companyMatch =
    query.match(/\b(?:company|at)\s+([A-Za-z0-9&.\- ]+)/i) ??
    query.match(/\bfor\s+([A-Za-z0-9&.\- ]+)/i);
  const company = companyMatch?.[1]?.trim() ?? "";

  if (company) {
    cleaned = cleaned.replace(companyMatch?.[0] ?? "", " ").replace(/\s+/g, " ").trim();
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first_name = parts.length > 1 ? titleCase(parts.slice(0, -1).join(" ")) : "";
  const last_name = titleCase(parts.at(-1) ?? cleaned ?? "Unknown");

  return {
    first_name,
    last_name,
    email,
    mobile_phone,
    assigned_account,
    company,
  };
}

export function SearchCreateContactFallback({ query }: { query: string }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    if (!open) return;
    getContactAccountOptions()
      .then((rows) =>
        setAccounts(rows)
      )
      .catch(() => setAccounts([]));
  }, [open]);

  const seed = useMemo(() => parseContactSeed(query), [query]);
  const matchedAccount = useMemo(
    () =>
      seed.company
        ? accounts.find((account) =>
            account.name.toLowerCase().includes(seed.company.toLowerCase())
          )
        : undefined,
    [accounts, seed.company]
  );

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
            <NewContactForm
              accounts={accounts}
              initialValues={{
                first_name: seed.first_name,
                last_name: seed.last_name,
                email: seed.email,
                mobile_phone: seed.mobile_phone,
                assigned_account: matchedAccount?.id ?? "",
              }}
              onFinish={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
