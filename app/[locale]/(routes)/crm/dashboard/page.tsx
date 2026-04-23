import React from "react";

import Container from "../../components/ui/Container";
import CRMKanban from "./_components/CRMKanban";
import { getAllCrmData } from "@/actions/crm/get-crm-data";

const CrmDashboardPage = async () => {
  const crmData = await getAllCrmData();

  return (
    <Container
      title="CRM Dashboard"
      description="In development. After this compoment is finished, there will be a optimistic update of the data."
    >
      <div className="h-full w-full overflow-hidden">
        <CRMKanban
          salesStages={crmData.saleStages}
          opportunities={crmData.opportunities}
          crmData={crmData}
        />
      </div>
    </Container>
  );
};

export default CrmDashboardPage;
