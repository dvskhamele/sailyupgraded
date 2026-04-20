import { prismadb } from "@/lib/prisma";

export const LOST_STAGE_ORDER = -1;
export const DEFAULT_FIRST_STAGE_NAME = "First Step";
export const DEFAULT_LOST_STAGE_NAME = "Lost";

type SalesStageRow = {
  id: string;
  name: string;
  probability: number | null;
  order: number | null;
};

function sortRegularStages<T extends SalesStageRow>(stages: T[]) {
  return [...stages].sort((a, b) => {
    const aProb = a.probability ?? Number.MAX_SAFE_INTEGER;
    const bProb = b.probability ?? Number.MAX_SAFE_INTEGER;
    if (aProb !== bProb) return aProb - bProb;
    return a.name.localeCompare(b.name);
  });
}

export async function ensureProtectedSalesStages() {
  let lostStage = await prismadb.crm_Opportunities_Sales_Stages.findFirst({
    where: { order: LOST_STAGE_ORDER },
  });

  if (!lostStage) {
    lostStage = await prismadb.crm_Opportunities_Sales_Stages.create({
      data: {
        v: 0,
        name: DEFAULT_LOST_STAGE_NAME,
        order: LOST_STAGE_ORDER,
      },
    });
  }

  const regularCount = await prismadb.crm_Opportunities_Sales_Stages.count({
    where: { NOT: { order: LOST_STAGE_ORDER } },
  });

  if (regularCount === 0) {
    await prismadb.crm_Opportunities_Sales_Stages.create({
      data: {
        v: 0,
        name: DEFAULT_FIRST_STAGE_NAME,
        probability: 0,
        order: 0,
      },
    });
  }
}

export async function getSalesStageCollections() {
  await ensureProtectedSalesStages();

  const allStages = await prismadb.crm_Opportunities_Sales_Stages.findMany();
  const lostStage =
    allStages.find((stage) => stage.order === LOST_STAGE_ORDER) ?? null;
  const regularStages = sortRegularStages(
    allStages.filter((stage) => stage.order !== LOST_STAGE_ORDER)
  );
  const firstStage = regularStages[0] ?? null;

  return {
    allStages,
    regularStages,
    firstStage,
    lostStage,
  };
}
