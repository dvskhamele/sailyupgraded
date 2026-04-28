import { Suspense } from "react";

import CrmTableSkeleton from "@/components/skeletons/crm-table-skeleton";

import Container from "../../components/ui/Container";
import LeadsView from "../components/LeadsView";

import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getLeads } from "@/actions/crm/get-leads";
import { getProductsFull } from "@/actions/crm/products/get-products";
import { serializeDecimals, serializeDecimalsList } from "@/lib/serialize-decimals";
import { getTranslations } from "next-intl/server";

const LeadsPage = async () => {
  const t = await getTranslations("CrmPage");
  const [rawCrmData, rawLeads, rawProducts] = await Promise.all([
    getAllCrmData(),
    getLeads(),
    getProductsFull(),
  ]);
  const crmData = serializeDecimals(rawCrmData);
  const leads = serializeDecimalsList(rawLeads);
  const products = serializeDecimalsList(rawProducts);

  return (
    <Container
      title={t("leads.pageTitle")}
      description={t("leads.pageDescription")}
    >
      <Suspense fallback={<CrmTableSkeleton />}>
        <LeadsView crmData={crmData} data={leads} products={products} />
      </Suspense>
    </Container>
  );
};

export default LeadsPage;
