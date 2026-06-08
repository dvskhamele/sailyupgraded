import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import ContactsViewClient from "./ContactsViewClient";
import {
  DEFAULT_SMTP2GO_SENDER,
  isAllowedSmtp2GoSender,
} from "@/lib/email/sender-policy";
import { getEmailFromAddress } from "@/lib/env";

type ContactOption = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

export type ContactListItem = {
  id: string;
  first_name: string | null;
  last_name: string;
  email: string | null;
  personal_email: string | null;
  office_phone: string | null;
  mobile_phone: string | null;
  website: string | null;
  position: string | null;
  status: boolean;
  type?: string | null;
  role?: string | null;
  assigned_to?: string | null;
  assigned_to_user?: {
    name?: string | null;
  } | null;
};

type CrmData = {
  accounts: ContactOption[];
  contactTypes?: ContactOption[];
  leadSources?: ContactOption[];
  leadStatuses?: ContactOption[];
  leadTypes?: ContactOption[];
  saleStages?: ContactOption[];
  products?: ContactOption[];
};

export interface ContactsViewProps {
  data: ContactListItem[];
  crmData: CrmData;
  accountId?: string;
  activeRole?: string;
  defaultEmailFrom?: string;
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
  const configuredEmailFrom = props.defaultEmailFrom ?? getEmailFromAddress();
  const defaultEmailFrom = isAllowedSmtp2GoSender(configuredEmailFrom)
    ? configuredEmailFrom
    : DEFAULT_SMTP2GO_SENDER;

  const labels = {
    addNew: t("contacts.addNew"),
    sheetDescription: t("contacts.sheetDescription"),
    empty: t("contacts.empty"),
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ContactsViewClient
        {...props}
        defaultEmailFrom={defaultEmailFrom}
        labels={labels}
      />
    </NextIntlClientProvider>
  );
};

export default ContactsView;
