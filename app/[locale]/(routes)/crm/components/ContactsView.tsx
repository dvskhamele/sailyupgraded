import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

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
};

export interface ContactsViewProps {
  data: any[];
  crmData: CrmData;
  accountId?: string;
  activeRole?: string;
}

const ContactsView = async (props: ContactsViewProps) => {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ContactsViewClient {...props} />
    </NextIntlClientProvider>
  );
};

export default ContactsView;
