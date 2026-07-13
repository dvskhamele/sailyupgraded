import { cache } from "react";
import { prismadb, withPrismaRetry } from "@/lib/prisma";

export const LOST_STAGE_ORDER = -1;
export const DEFAULT_FIRST_STAGE_NAME = "First Step";
export const DEFAULT_LOST_STAGE_NAME = "Lost";

type SalesStageDbRow = {
  id: string;
  v: number;
  name: string;
  probability: number | null;
  order: number | null;
};

type SalesStageRow = SalesStageDbRow & {
  countInRevenue: boolean;
  countInPipeline: boolean;
};

function sortRegularStages<T extends SalesStageRow>(stages: T[]) {
  return [...stages].sort((a, b) => {
    return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
  });
}

function normalizeStages(stages: SalesStageDbRow[]): SalesStageRow[] {
  return stages.map((stage) => ({
    ...stage,
    countInRevenue: stage.order !== LOST_STAGE_ORDER,
    countInPipeline: stage.order !== LOST_STAGE_ORDER,
  }));
}

export async function ensureProtectedSalesStages(
  existingStages?: SalesStageRow[]
): Promise<SalesStageRow[]> {
  const stages: SalesStageRow[] =
    existingStages ??
    normalizeStages(
      await prismadb.crm_Opportunities_Sales_Stages.findMany({
        select: {
          id: true,
          v: true,
          name: true,
          probability: true,
          order: true,
        },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      })
    );

  const lostStageExists = stages.some(
    (stage) => stage.order === LOST_STAGE_ORDER
  );

  const hasRegularStages = stages.some(
    (stage) => stage.order !== LOST_STAGE_ORDER
  );

  const writes: Promise<unknown>[] = [];

  if (!lostStageExists) {
    writes.push(
      prismadb.crm_Opportunities_Sales_Stages.create({
        data: {
          v: 0,
          name: DEFAULT_LOST_STAGE_NAME,
          probability: 0,
          order: LOST_STAGE_ORDER,
        },
      })
    );
  }

  if (!hasRegularStages) {
    writes.push(
      prismadb.crm_Opportunities_Sales_Stages.create({
        data: {
          v: 0,
          name: DEFAULT_FIRST_STAGE_NAME,
          probability: 0,
          order: 0,
        },
      })
    );
  }

  if (writes.length === 0) {
    return stages;
  }

  await Promise.all(writes);

  const newRawStages = await prismadb.crm_Opportunities_Sales_Stages.findMany({
    select: {
      id: true,
      v: true,
      name: true,
      probability: true,
      order: true,
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  return normalizeStages(newRawStages);
}

async function loadSalesStageCollections() {
  const allStages = await ensureProtectedSalesStages();

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

export const getSalesStageCollections = cache(async () => {
  return withPrismaRetry(loadSalesStageCollections);
});