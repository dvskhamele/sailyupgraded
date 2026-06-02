import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

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
}

const LeadsView = async (props: LeadsViewProps) => {
  const locale = await getLocale();
  const messages = await getMessages();
  const configuredEmailFrom = props.defaultEmailFrom ?? getEmailFromAddress();
  const defaultEmailFrom = isAllowedSmtp2GoSender(configuredEmailFrom)
    ? configuredEmailFrom
    : DEFAULT_SMTP2GO_SENDER;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LeadsViewClient {...props} defaultEmailFrom={defaultEmailFrom} />
    </NextIntlClientProvider>
  );
};

export default LeadsView;
