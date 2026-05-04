"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
import { matchesContactRoleFilter } from "@/lib/contact-options";

import type { getAllCrmData } from "@/actions/crm/get-crm-data";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

interface ContactsViewProps {
  data: any[];
  crmData: CrmData;
  accountId?: string;
  activeRole?: string;
}

const ContactsView = ({ data, crmData, activeRole }: ContactsViewProps) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations("CrmPage");

  const { accounts, contactTypes, leadSources, leadStatuses, leadTypes } = crmData;
  const currentRole = activeRole ?? "all";
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
                {t("contacts.viewTitle")}
              </Link>
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <ImportContactsDialog />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" aria-label={t("contacts.addNew")} data-testid="add-contact-btn">+</Button>
              </SheetTrigger>
              <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{t("contacts.sheetTitle")}</SheetTitle>
                  <SheetDescription>
                    {t("contacts.sheetDescription")}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <NewContactForm
                    accounts={accounts}
                    contactTypes={contactTypes}
                    leadSources={leadSources}
                    leadStatuses={leadStatuses}
                    leadTypes={leadTypes}
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
          t("contacts.empty")
        ) : (
          <ContactsDataTable
            data={filteredData}
            columns={createColumns(contactTypes)}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ContactsView;
