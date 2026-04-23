"use client";

import { useState, useEffect, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
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
import useDebounce from "@/hooks/useDebounce";
import { searchAccounts } from "@/actions/crm/accounts/search-accounts";
import { getAccountById } from "@/actions/crm/accounts/get-account-by-id";
import { createAccount } from "@/actions/crm/accounts/create-account";

type Account = { id: string; name: string };

interface AccountSearchComboboxProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}

const PAGE_SIZE = 50;

export function AccountSearchCombobox({
  value,
  onChange,
  placeholder = "Select account",
  disabled,
  name,
}: AccountSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [accumulatedAccounts, setAccumulatedAccounts] = useState<Account[]>([]);
  const [listData, setListData] = useState<{
    accounts: Account[];
    hasMore: boolean;
  } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const selectedInList = accumulatedAccounts.find((a) => a.id === value);

  // Load list when open
  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const data = await searchAccounts({
        search: debouncedSearch,
        skip,
        take: PAGE_SIZE,
      });
      setListData(data);
      setAccumulatedAccounts((prev) =>
        skip === 0 ? data.accounts : [...prev, ...data.accounts]
      );
    });
  }, [open, debouncedSearch, skip]);

  // Load selected account name if not in list
  useEffect(() => {
    if (!value || selectedInList) return;
    startTransition(async () => {
      const account = await getAccountById(value);
      setSelectedAccount(account);
    });
  }, [value, selectedInList]);

  const displayAccount = selectedInList ?? selectedAccount ?? null;

  const handleSelect = (accountId: string) => {
    onChange(accountId === value ? "" : accountId);
    if (accountId === value) {
      setSelectedAccount(null);
    }
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const result = await createAccount({ name });
      if (result?.error || !result?.data?.id) {
        toast.error(result?.error ?? "Failed to create account");
        return;
      }

      const created = { id: result.data.id, name: result.data.name as string };
      setAccumulatedAccounts((prev) => [created, ...prev]);
      setSelectedAccount(created);
      onChange(created.id);
      setSearch("");
      setOpen(false);
      toast.success(`Account "${created.name}" created`);
    } catch (error) {
      toast.error("Failed to create account");
    } finally {
      setIsCreating(false);
    }
  };

  const isLoading = isPending && skip === 0 && accumulatedAccounts.length === 0;
  const trimmedSearch = search.trim();
  const showCreateOption =
    trimmedSearch.length > 0 &&
    !isLoading &&
    accumulatedAccounts.length === 0;

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
            type="button"
          >
            <span className="truncate text-sm">
              {displayAccount?.name ?? (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search accounts..."
              value={search}
              onValueChange={(nextValue) => {
                setSearch(nextValue);
                setSkip(0);
                setAccumulatedAccounts([]);
                setListData(null);
              }}
            />
            <CommandList onWheelCapture={(e) => e.stopPropagation()}>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <div className="space-y-2 py-2 text-center">
                      <p className="text-sm text-muted-foreground">No accounts found.</p>
                      {showCreateOption && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCreate}
                          disabled={isCreating}
                        >
                          {isCreating ? "Creating..." : `Create "${trimmedSearch}"`}
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {accumulatedAccounts.map((account) => (
                      <CommandItem
                        key={account.id}
                        value={account.id}
                        onSelect={handleSelect}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === account.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {account.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {showCreateOption && (
                    <div className="border-t p-1">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm font-normal"
                        type="button"
                        onClick={handleCreate}
                        disabled={isCreating}
                      >
                        {isCreating ? "Creating..." : `Create "${trimmedSearch}"`}
                      </Button>
                    </div>
                  )}
                  {listData?.hasMore && (
                    <div className="p-1">
                      <Button
                        variant="ghost"
                        className="w-full text-sm"
                        type="button"
                        onClick={() => setSkip((prev) => prev + PAGE_SIZE)}
                        disabled={isPending}
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
