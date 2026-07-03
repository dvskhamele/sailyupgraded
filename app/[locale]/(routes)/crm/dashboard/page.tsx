import React from "react";

import Container from "../../components/ui/Container";
import CRMKanban from "./_components/CRMKanban";

import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getOpportunities } from "@/actions/crm/get-opportunities";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

const CrmDashboardPage = async () => {
  const crmData = await getAllCrmData();
  const rawOpportunities = await getOpportunities();
  const opportunities = serializeDecimalsList(rawOpportunities);

  return (
    <Container title="" description="">
      <div className="h-full w-full overflow-hidden">
        <CRMKanban
          salesStages={crmData.saleStages}
          opportunities={opportunities}
          crmData={crmData}
        />
      </div>
    </Container>
  );
};

export default CrmDashboardPage;