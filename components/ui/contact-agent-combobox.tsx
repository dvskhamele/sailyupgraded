"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import useDebounce from "@/hooks/useDebounce";
import { createAgentOption } from "@/actions/crm/contacts/create-agent-option";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Agent = {
  id: string;
  name: string;
  email?: string | null;
  serial?: string | null;
};

type AgentSearchResponse = {
  agents: Agent[];
  hasMore: boolean;
};

type ContactAgentComboboxProps = {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const PAGE_SIZE = 50;

export function ContactAgentCombobox({
  value,
  onChange,
  placeholder = "Select agent",
  disabled,
}: ContactAgentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [listData, setListData] = useState<AgentSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, startCreating] = useTransition();
  const debouncedSearch = useDebounce(search, 300);
  const trimmedSearch = search.trim();
  const hasExactMatch = agents.some(
    (agent) => agent.name.trim().toLowerCase() === trimmedSearch.toLowerCase(),
  );

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      skip: String(skip),
      take: String(PAGE_SIZE),
    });
    const nextSearch = debouncedSearch.trim();
    if (nextSearch) params.set("search", nextSearch);

    fetch(`/api/crm/contact-agents/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load agents");
        return (await response.json()) as AgentSearchResponse;
      })
      .then((data) => {
        setListData(data);
        setAgents((current) =>
          skip === 0 ? data.agents : [...current, ...data.agents],
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setListData({ agents: [], hasMore: false });
        if (skip === 0) setAgents([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, open, skip]);

  const handleCreate = () => {
    if (!trimmedSearch) return;

    startCreating(async () => {
      const result = await createAgentOption(trimmedSearch);
      if (result?.error || !result?.data) {
        toast.error(result?.error ?? "Unable to create agent");
        return;
      }

      setAgents((current) => [result.data, ...current]);
      onChange(result.data.name);
      setSearch("");
      setOpen(false);
      toast.success("Agent created");
    });
  };

  const isInitialLoading = isLoading && skip === 0 && agents.length === 0;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setIsLoading(true);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate text-sm", !value && "text-muted-foreground")}>
            {value || placeholder}
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
            placeholder="Search agents..."
            value={search}
            onValueChange={(nextValue) => {
              setSearch(nextValue);
              setSkip(0);
              setAgents([]);
              setListData(null);
              setIsLoading(true);
            }}
          />
          <CommandList onWheelCapture={(event) => event.stopPropagation()}>
            {isInitialLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="space-y-2 py-2 text-center">
                    <p className="text-sm text-muted-foreground">No agents found.</p>
                    {trimmedSearch && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCreate}
                        disabled={isCreating}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {isCreating ? "Creating..." : `Create agent "${trimmedSearch}"`}
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {agents.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={agent.name}
                      onSelect={() => {
                        onChange(agent.name === value ? "" : agent.name);
                        setSearch("");
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === agent.name ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="min-w-0">
                        <div className="truncate">{agent.name}</div>
                        {(agent.email || agent.serial) && (
                          <div className="truncate text-xs text-muted-foreground">
                            {[agent.serial, agent.email].filter(Boolean).join(" - ")}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                  {trimmedSearch && !hasExactMatch && agents.length > 0 && (
                    <CommandItem value={trimmedSearch} onSelect={handleCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      {isCreating ? "Creating..." : `Create agent "${trimmedSearch}"`}
                    </CommandItem>
                  )}
                </CommandGroup>
                {listData?.hasMore && (
                  <div className="p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-sm"
                      onClick={() => {
                        setIsLoading(true);
                        setSkip((current) => current + PAGE_SIZE);
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
