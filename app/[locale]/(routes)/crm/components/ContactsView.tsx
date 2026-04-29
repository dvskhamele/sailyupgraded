"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { Download } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { createColumns } from "../contacts/table-components/columns";
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

import type { getAllCrmData } from "@/actions/crm/get-crm-data";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

interface ContactsViewProps {
  data: any[];
  crmData: CrmData;
  accountId?: string;
}

const ContactsView = ({ data, crmData }: ContactsViewProps) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations("CrmPage");

  const { accounts, contactTypes } = crmData;

  const handleExportContacts = () => {
    if (!data?.length) {
      return;
    }

    const rows = data.map((contact: any) => ({
      "First Name": contact.first_name ?? "",
      "Last Name": contact.last_name ?? "",
      Email: contact.email ?? "",
      "Personal Email": contact.personal_email ?? "",
      "Office Phone": contact.office_phone ?? "",
      "Mobile Phone": contact.mobile_phone ?? "",
      Website: contact.website ?? "",
      Position: contact.position ?? "",
      Status: contact.status ? "Active" : "Inactive",
      Role: contact.contact_type?.name ?? "",
      Account: contact.assigned_accounts?.name ?? "",
      "Assigned To": contact.assigned_to_user?.name ?? "",
      Address: contact.address ?? "",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle>
              <Link href="/crm/contacts" className="hover:underline">
                {t("contacts.viewTitle")}
              </Link>
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportContacts}
              disabled={!data?.length}
              data-testid="export-contacts-btn"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
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
        {!data || data.length === 0 ? (
          t("contacts.empty")
        ) : (
          <ContactsDataTable
            data={data}
            columns={createColumns(contactTypes)}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ContactsView;
