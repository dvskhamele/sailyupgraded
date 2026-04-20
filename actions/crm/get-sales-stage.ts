import { getSalesStageCollections } from "@/lib/crm-sales-stages";

export const getSaleStages = async () => {
  const { regularStages } = await getSalesStageCollections();
  return regularStages;
};
