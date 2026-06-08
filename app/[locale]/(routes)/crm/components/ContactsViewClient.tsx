"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createColumns } from "../contacts/table-components/columns";
import { ImportContactsDialog } from "../contacts/components/ImportContactsDialog";
import { NewContactForm } from "../contacts/components/NewContactForm";
import { ContactsDataTable } from "../contacts/table-components/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getContactRoleView, matchesContactRoleFilter } from "@/lib/contact-options";

import type { ContactListItem, ContactsViewProps } from "./ContactsView";

type AssignedMemberOption = {
  id: string;
  name: string;
};

const ContactsViewClient = ({
  data,
  crmData,
  activeRole,
  defaultEmailFrom,
  labels: providedLabels,
}: ContactsViewProps) => {
  const [open, setOpen] = useState(false);
  const [selectedAssignedMember, setSelectedAssignedMember] = useState("all");

  const { accounts, contactTypes, leadSources, leadStatuses, leadTypes, products } = crmData;
  const saleStages = crmData.saleStages ?? [];
  const labels = {
    addNew: "Add new",
    sheetDescription: "Add or update contact details",
    empty: "No contacts found",
    ...(providedLabels ?? {}),
  };
  const currentRole = activeRole ?? "all";
  const roleView = getContactRoleView(currentRole);
  const filteredData = useMemo(
    () => data.filter((contact) => matchesContactRoleFilter(currentRole, contact.role)),
    [currentRole, data]
  );
  const assignedMembers = useMemo<AssignedMemberOption[]>(() => {
    const membersById = new Map<string, AssignedMemberOption>();

    for (const contact of filteredData) {
      if (!contact.assigned_to) {
        continue;
      }

      membersById.set(contact.assigned_to, {
        id: contact.assigned_to,
        name: contact.assigned_to_user?.name?.trim() || contact.assigned_to,
      });
    }

    return Array.from(membersById.values()).sort((first, second) =>
      first.name.localeCompare(second.name)
    );
  }, [filteredData]);
  const finalFilteredContacts = useMemo<ContactListItem[]>(() => {
    if (selectedAssignedMember === "all") {
      return filteredData;
    }

    return filteredData.filter(
      (contact) => contact.assigned_to === selectedAssignedMember
    );
  }, [filteredData, selectedAssignedMember]);
  const assignedMemberFilter = (
    <Select
      value={selectedAssignedMember}
      onValueChange={setSelectedAssignedMember}
    >
      <SelectTrigger
        className="h-8 w-[180px] lg:w-[220px]"
        aria-label="Filter by assigned member"
      >
        <SelectValue placeholder="Assigned Member" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Members</SelectItem>
        {assignedMembers.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            {member.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle>
              <Link href="/crm/contacts" prefetch={false} className="hover:underline">
                {roleView.heading}
              </Link>
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <ImportContactsDialog importRole={roleView.defaultCreateRole} />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" aria-label={labels.addNew} data-testid="add-contact-btn">+</Button>
              </SheetTrigger>
              <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{roleView.createTitle}</SheetTitle>
                  <SheetDescription>
                    {labels.sheetDescription}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <NewContactForm
                    accounts={accounts}
                    contactTypes={contactTypes}
                    leadSources={leadSources}
                    leadStatuses={leadStatuses}
                    leadTypes={leadTypes}
                    saleStages={saleStages}
                    products={products}
                    defaultRole={roleView.defaultCreateRole}
                    onFinish={() => setOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <Separator />
      </CardHeader>

      <CardContent>
        {filteredData.length === 0 ? (
          labels.empty
        ) : (
          <ContactsDataTable
            data={finalFilteredContacts}
            columns={createColumns(contactTypes, accounts, leadSources, leadStatuses, leadTypes, products, saleStages)}
            defaultEmailFrom={defaultEmailFrom}
            assignedMemberFilter={assignedMemberFilter}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ContactsViewClient;
