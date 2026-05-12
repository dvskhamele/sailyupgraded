"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createContact } from "@/actions/crm/contacts/create-contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContactOption = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type OpportunityClientSelectProps = {
  value?: string | null;
  onChange: (value: string) => void;
  contacts?: ContactOption[];
  disabled?: boolean;
  accountId?: string | null;
};

function getContactName(contact: ContactOption) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || "Unnamed client";
}

function splitClientName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      first_name: "",
      last_name: parts[0] || "Contact",
    };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

export function OpportunityClientSelect({
  value,
  onChange,
  contacts = [],
  disabled,
  accountId,
}: OpportunityClientSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [localContacts, setLocalContacts] = useState<ContactOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const allContacts = useMemo(() => {
    const seen = new Set<string>();
    return [...localContacts, ...contacts].filter((contact) => {
      if (!contact?.id || seen.has(contact.id)) {
        return false;
      }

      seen.add(contact.id);
      return true;
    });
  }, [contacts, localContacts]);

  const filteredContacts = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return allContacts;
    }

    return allContacts.filter((contact) =>
      getContactName(contact).toLowerCase().includes(query)
    );
  }, [allContacts, searchValue]);

  const canCreateClient = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return false;
    }

    return !allContacts.some((contact) => getContactName(contact).toLowerCase() === query);
  }, [allContacts, searchValue]);

  const handleCreateClient = async () => {
    const clientName = searchValue.trim();
    if (!clientName) {
      return;
    }

    setIsCreating(true);
    try {
      const name = splitClientName(clientName);
      const result = await createContact({
        ...name,
        status: true,
        country: "United States",
        assigned_account: accountId || undefined,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      const created = result?.data as ContactOption | undefined;
      if (!created?.id) {
        toast.error("Client was created, but could not be selected automatically.");
        return;
      }

      setLocalContacts((current) => [created, ...current]);
      onChange(created.id);
      setSearchValue("");
      toast.success("Contact created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create contact");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select a client" />
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-popover p-2">
          <Input
            value={searchValue}
            placeholder="Search or create contact..."
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
        {filteredContacts.map((contact) => (
          <SelectItem key={contact.id} value={contact.id}>
            {getContactName(contact)}
          </SelectItem>
        ))}
        {canCreateClient ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={isCreating}
              onClick={handleCreateClient}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isCreating ? "Creating..." : `Create contact "${searchValue.trim()}"`}
            </Button>
          </div>
        ) : null}
      </SelectContent>
    </Select>
  );
}
