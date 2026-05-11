import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import ContactsViewClient from "./ContactsViewClient";

type ContactOption = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

type CrmData = {
  accounts: ContactOption[];
  contactTypes?: ContactOption[];
  leadSources?: ContactOption[];
  leadStatuses?: ContactOption[];
  leadTypes?: ContactOption[];
  products?: ContactOption[];
};

export interface ContactsViewProps {
  data: any[];
  crmData: CrmData;
  accountId?: string;
  activeRole?: string;
  labels?: {
    addNew: string;
    sheetDescription: string;
    empty: string;
  };
}

const ContactsView = async (props: ContactsViewProps) => {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("CrmPage");

  const labels = {
    addNew: t("contacts.addNew"),
    sheetDescription: t("contacts.sheetDescription"),
    empty: t("contacts.empty"),
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ContactsViewClient {...props} labels={labels} />
    </NextIntlClientProvider>
  );
};

export default ContactsView;
