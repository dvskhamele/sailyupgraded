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

import type { ContactsViewProps } from "./ContactsView";

const ContactsViewClient = ({ data, crmData, activeRole, labels: providedLabels }: ContactsViewProps) => {
  const [open, setOpen] = useState(false);

  const { accounts, contactTypes, leadSources, leadStatuses, leadTypes, products } = crmData;
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
            <ImportContactsDialog />
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
        {!filteredData || filteredData.length === 0 ? (
          labels.empty
        ) : (
          <ContactsDataTable
            data={filteredData}
            columns={createColumns(contactTypes, accounts, leadSources, leadStatuses, leadTypes, products)}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ContactsViewClient;
