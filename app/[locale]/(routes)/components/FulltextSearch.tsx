"use client";
import { Button } from "@/components/ui/button";
import { EmailLink } from "@/components/ui/contact-link";
import { Input } from "@/components/ui/input";
import { SearchIcon, UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useTransition } from "react";
import useDebounce from "@/hooks/useDebounce";
import { searchContacts, ContactSearchItem } from "@/actions/crm/contacts/search-contacts";
import { searchUsers } from "@/actions/user/search-users";
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
import { getContactFormOptions } from "@/actions/crm/contacts/get-contact-form-options";
import { buildSmartContactInitialValues } from "@/lib/smart-contact-input";
import type { UnifiedPersonFormValues } from "@/components/crm/unified-person-form";

const FulltextSearch = () => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactSearchItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formOptions, setFormOptions] = useState<Awaited<ReturnType<typeof getContactFormOptions>> | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<UnifiedPersonFormValues> | undefined>();

  const router = useRouter();
  const debouncedSearch = useDebounce(search, 300);
  const visibleResults = debouncedSearch.length >= 2 ? results : [];

  useEffect(() => {
    if (debouncedSearch.length < 2) return;

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

  const openAddContact = async () => {
    try {
      const [options, users] = await Promise.all([
        getContactFormOptions(),
        searchUsers({ take: 1 }),
      ]);

      const parsedInitialValues = buildSmartContactInitialValues(search, {
        accounts: options.accounts,
        contactTypes: options.contactTypes,
        leadSources: options.leadSources,
        leadStatuses: options.leadStatuses,
        leadTypes: options.leadTypes,
        assignedTo: users.users[0]?.id ?? "",
      });

      setFormOptions(options);
      setInitialValues(parsedInitialValues);
    } catch {
      setFormOptions({
        accounts: [],
        contactTypes: [],
        leadSources: [],
        leadStatuses: [],
        leadTypes: [],
      });
      setInitialValues(buildSmartContactInitialValues(search));
    }
    setDialogOpen(true);
    setOpen(false);
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
                setSearch(e.target.value);
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
                    <p className="text-sm text-muted-foreground mb-3">No contacts found.</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={openAddContact}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Contact
                    </Button>
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
            <DialogTitle>Quick Add Contact</DialogTitle>
            <DialogDescription>
              Create a new contact record. The name is pre-filled from your search.
            </DialogDescription>
          </DialogHeader>
          {formOptions && (
            <NewContactForm 
              accounts={formOptions.accounts}
              contactTypes={formOptions.contactTypes}
              leadSources={formOptions.leadSources}
              leadStatuses={formOptions.leadStatuses}
              leadTypes={formOptions.leadTypes}
              onFinish={() => {
                setDialogOpen(false);
                router.refresh();
              }}
              initialValues={initialValues}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FulltextSearch;
