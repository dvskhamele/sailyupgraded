import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import type { getAllCrmData } from "@/actions/crm/get-crm-data";
import LeadsViewClient from "./LeadsViewClient";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

export interface LeadsViewProps {
  data: any[];
  crmData: CrmData;
  products?: { id: string; name: string; status?: string | null }[];
  sourceFilter?: string;
}

const LeadsView = async (props: LeadsViewProps) => {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LeadsViewClient {...props} />
    </NextIntlClientProvider>
  );
};

export default LeadsView;
