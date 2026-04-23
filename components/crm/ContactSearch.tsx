"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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
import useDebounce from "@/hooks/useDebounce";
import { searchContacts, ContactSearchItem } from "@/actions/crm/contacts/search-contacts";
import { NewContactForm } from "@/app/[locale]/(routes)/crm/contacts/components/NewContactForm";
import type { getAllCrmData } from "@/actions/crm/get-crm-data";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

interface ContactSearchProps {
  crmData: CrmData;
}

export function ContactSearch({ crmData }: ContactSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactSearchItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const handleSelect = (contactId: string) => {
    router.push(`/crm/contacts/${contactId}`);
    setOpen(false);
  };

  const isLoading = isPending && search.length >= 2;

  return (
    <div className="w-full max-w-sm mb-6">
      <div className="relative group">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative w-full cursor-pointer">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Smart search contacts..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (!open) setOpen(true);
                }}
                className="pl-9 pr-4 bg-background border-muted-foreground/20 focus-visible:ring-primary h-10 w-full"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
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
                  <CommandGroup heading="Results">
                    {visibleResults.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={contact.id}
                        onSelect={handleSelect}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </span>
                          {contact.email && (
                            <span className="text-xs text-muted-foreground">
                              {contact.email}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  !isLoading && search.length >= 2 && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-3">No contacts found.</p>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setDialogOpen(true);
                          setOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Add Contact
                      </Button>
                    </div>
                  )
                )}
                {search.length < 2 && search.length > 0 && (
                   <div className="p-4 text-center text-sm text-muted-foreground">
                     Type at least 2 characters...
                   </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Add Contact</DialogTitle>
            <DialogDescription>
              Create a new contact record. Some fields are pre-filled from your search.
            </DialogDescription>
          </DialogHeader>
          <NewContactForm 
            accounts={crmData.accounts}
            contactTypes={crmData.contactTypes}
            onFinish={() => {
              setDialogOpen(false);
              router.refresh();
            }}
            initialValues={{
              last_name: search,
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
