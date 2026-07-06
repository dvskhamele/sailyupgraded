import React from "react";

import Container from "../../components/ui/Container";
import CRMKanban from "./_components/CRMKanban";

import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getOpportunities } from "@/actions/crm/get-opportunities";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

const CrmDashboardPage = async () => {
  const organizationId = await requireOrganizationId();
  console.log("[dashboard] organizationId", organizationId);

  return runWithOrganizationContext(organizationId, async () => {
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
  });
};

export default CrmDashboardPage;