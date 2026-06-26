import React from "react";

import Container from "../../components/ui/Container";
import CRMKanban from "./_components/CRMKanban";
import { DemoModeGate } from "./_components/DemoModeGate";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getOpportunities } from "@/actions/crm/get-opportunities";
import {
  DEFAULT_SMTP2GO_SENDER,
  isAllowedSmtp2GoSender,
} from "@/lib/email/sender-policy";
import { getEmailFromAddress } from "@/lib/env";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

const CrmDashboardPage = async () => {
  const crmData = await getAllCrmData();
  const rawOpportunities = await getOpportunities();
  const opportunities = serializeDecimalsList(rawOpportunities);
  const configuredEmailFrom = getEmailFromAddress();
  const defaultEmailFrom = isAllowedSmtp2GoSender(configuredEmailFrom)
    ? configuredEmailFrom
    : DEFAULT_SMTP2GO_SENDER;

  return (
    <Container
      title=""
      description=""   
    >
      <div className="h-full w-full overflow-hidden">
        <DemoModeGate />
        <CRMKanban
          salesStages={crmData.saleStages}
          opportunities={opportunities}
          crmData={crmData}
          defaultEmailFrom={defaultEmailFrom}
        />
      </div>
    </Container>
  );
};

export default CrmDashboardPage;
