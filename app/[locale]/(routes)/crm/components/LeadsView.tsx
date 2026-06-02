import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import type { getAllCrmData } from "@/actions/crm/get-crm-data";
import {
  DEFAULT_SMTP2GO_SENDER,
  isAllowedSmtp2GoSender,
} from "@/lib/email/sender-policy";
import { getEmailFromAddress } from "@/lib/env";
import LeadsViewClient from "./LeadsViewClient";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

export interface LeadsViewProps {
  data: any[];
  crmData: CrmData;
  products?: { id: string; name: string; status?: string | null }[];
  sourceFilter?: string;
  defaultEmailFrom?: string;
  labels?: {
    viewTitle: string;
    addNew: string;
    sheetTitle: string;
    sheetDescription: string;
    empty: string;
  };
}

const LeadsView = async (props: LeadsViewProps) => {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("CrmPage");
  const configuredEmailFrom = props.defaultEmailFrom ?? getEmailFromAddress();
  const defaultEmailFrom = isAllowedSmtp2GoSender(configuredEmailFrom)
    ? configuredEmailFrom
    : DEFAULT_SMTP2GO_SENDER;
  const labels = {
    viewTitle: t("leads.viewTitle"),
    addNew: t("leads.addNew"),
    sheetTitle: t("leads.sheetTitle"),
    sheetDescription: t("leads.sheetDescription"),
    empty: t("leads.empty"),
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LeadsViewClient
        {...props}
        defaultEmailFrom={defaultEmailFrom}
        labels={labels}
      />
    </NextIntlClientProvider>
  );
};

export default LeadsView;
