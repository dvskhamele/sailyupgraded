"use client";

import { useState, useEffect, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Link } from "@/i18n/navigation";

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
import { getUserById } from "@/actions/user/get-user-by-id";

type User = {
  id: string;
  name: string | null;
  email?: string | null;
  avatar: string | null;
};
type UserSearchResponse = {
  users: User[];
  hasMore: boolean;
};

interface UserSearchComboboxProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}

const PAGE_SIZE = 50;

export function UserSearchCombobox({
  value,
  onChange,
  placeholder = "Select user",
  disabled,
  name,
}: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [accumulatedUsers, setAccumulatedUsers] = useState<User[]>([]);
  const [listData, setListData] = useState<{
    users: User[];
    hasMore: boolean;
  } | null>(null);
  const [singleUser, setSingleUser] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [, startTransition] = useTransition();

  const debouncedSearch = useDebounce(search, 300);

  const selectedInList = accumulatedUsers.find((u) => u.id === value);

  // Load list of users when open
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      skip: String(skip),
      take: String(PAGE_SIZE),
    });
    const trimmedSearch = debouncedSearch.trim();
    if (trimmedSearch) {
      params.set("search", trimmedSearch);
    }

    setIsLoadingUsers(true);
    fetch(`/api/crm/agents/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load users");
        }
        return (await response.json()) as UserSearchResponse;
      })
      .then((data) => {
        setListData(data);
        setAccumulatedUsers((prev) =>
          skip === 0 ? data.users : [...prev, ...data.users]
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setListData({ users: [], hasMore: false });
        if (skip === 0) {
          setAccumulatedUsers([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingUsers(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [open, debouncedSearch, skip]);

  // Load selected user if not in list
  useEffect(() => {
    if (!value || selectedInList) return;
    startTransition(async () => {
      const user = await getUserById(value);
      setSingleUser(user);
    });
  }, [value, selectedInList]);

  const displayUser = selectedInList ?? singleUser ?? null;
  const displayName = displayUser?.name ?? displayUser?.email ?? "";

  const handleSelect = (userId: string) => {
    onChange(userId === value ? "" : userId);
    if (userId === value) {
      setSingleUser(null);
    }
    setOpen(false);
  };

  const isLoading = isLoadingUsers && skip === 0 && accumulatedUsers.length === 0;
  const trimmedSearch = search.trim();

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
              {displayName || (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search users..."
              value={search}
              onValueChange={(nextValue) => {
                setSearch(nextValue);
                setSkip(0);
                setAccumulatedUsers([]);
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
                      <p className="text-sm text-muted-foreground">No users found.</p>
                      {trimmedSearch.length > 0 && (
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href="/admin/users">Create or invite user</Link>
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {accumulatedUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={handleSelect}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === user.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{user.name ?? user.email}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {listData?.hasMore && (
                    <div className="p-1">
                      <Button
                        variant="ghost"
                        className="w-full text-sm"
                        type="button"
                        onClick={() => setSkip((prev) => prev + PAGE_SIZE)}
                        disabled={isLoadingUsers}
                      >
                        {isLoadingUsers ? "Loading..." : "Load more"}
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
