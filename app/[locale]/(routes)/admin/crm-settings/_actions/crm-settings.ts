"use server";

import { z } from "zod";
import { prismadb as prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSalesStageCollections } from "@/lib/crm-sales-stages";

export type CrmConfigType =
  | "industry"
  | "contactType"
  | "leadSource"
  | "leadStatus"
  | "leadType"
  | "opportunityType"
  | "salesStage";

export type ConfigValue = {
  id: string;
  name: string;
  usageCount: number;
  position?: number;
  isProtected?: boolean;
  countInRevenue?: boolean;
};

export type ReorderSalesStageInput = {
  id: string;
  position: number;
};

const nameSchema = z.string().trim().min(1, "Name is required").max(100, "Max 100 characters");
const reorderSalesStagesSchema = z
  .array(
    z.object({
      id: z.string().trim().min(1, "Stage id is required"),
      position: z.number().int().min(0, "Position must be zero or greater"),
    })
  )
  .min(1, "At least one sales stage is required");

async function requireCrmSettingsAccess() {
  const { getSession } = await import("@/lib/auth-server");
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "admin") throw new Error("Forbidden");
  return session;
}

const configMap = {
  industry:        { model: () => prisma.crm_Industry_Type,               countRelation: "accounts",                              updateMany: null, hasOrder: true },
  contactType:     { model: () => prisma.crm_Contact_Types,               countRelation: "contacts",                              updateMany: () => prisma.crm_Contacts, hasOrder: false },
  leadSource:      { model: () => prisma.crm_Lead_Sources,                countRelation: "leads",                                 updateMany: () => prisma.crm_Leads, hasOrder: false },
  leadStatus:      { model: () => prisma.crm_Lead_Statuses,               countRelation: "leads",                                 updateMany: () => prisma.crm_Leads, hasOrder: true },
  leadType:        { model: () => prisma.crm_Lead_Types,                  countRelation: "leads",                                 updateMany: () => prisma.crm_Leads, hasOrder: false },
  opportunityType: { model: () => prisma.crm_Opportunities_Type,          countRelation: "assigned_opportunities",                updateMany: null, hasOrder: true },
  salesStage:      { model: () => prisma.crm_Opportunities_Sales_Stages,  countRelation: "assigned_opportunities_sales_stage",    updateMany: () => prisma.crm_Opportunities, hasOrder: true },
} as const;

const fkField: Record<CrmConfigType, string | null> = {
  industry:        "industry",
  contactType:     "contact_type_id",
  leadSource:      "lead_source_id",
  leadStatus:      "lead_status_id",
  leadType:        "lead_type_id",
  opportunityType: "type",
  salesStage:      "sales_stage",
};

export async function getConfigValues(configType: CrmConfigType): Promise<ConfigValue[]> {
  if (configType === "salesStage") {
    const { regularStages, firstStage, lostStage } = await getSalesStageCollections();
    const rows = await prisma.crm_Opportunities_Sales_Stages.findMany({
      select: {
        id: true,
        name: true,
        order: true,
        countInRevenue: true,
        _count: { select: { assigned_opportunities_sales_stage: true } }
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    const byId = new Map(rows.map((row: any) => [row.id, row]));
    const values: ConfigValue[] = regularStages.map((stage: any) => {
      const row = byId.get(stage.id);
      return {
        id: stage.id,
        name: stage.name,
        usageCount: row?._count?.assigned_opportunities_sales_stage ?? 0,
        position: stage.order ?? 0,
        isProtected: stage.id === firstStage?.id,
        countInRevenue: row?.countInRevenue ?? false,
      };
    });

    if (lostStage) {
      const row = byId.get(lostStage.id);
      values.push({
        id: lostStage.id,
        name: lostStage.name,
        usageCount: 0,
        position: lostStage.order ?? 0,
        isProtected: true,
        countInRevenue: row?.countInRevenue ?? false,
      });
    }

    return values;
  }

  const { model, countRelation, hasOrder } = configMap[configType];
  const rows = await (model() as any).findMany({
    select: {
      id: true,
      name: true,
      order: hasOrder ? true : false,
      _count: { select: { [countRelation]: true } }
    },
    orderBy: hasOrder ? { order: "asc" } : { name: "asc" },
  });
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    usageCount: r._count[countRelation] ?? 0,
  }));
}

export async function createConfigValue(
  configType: CrmConfigType, 
  name: string,
  countInRevenue?: boolean
): Promise<void> {
  const parsed = nameSchema.parse(name);
  const { model, hasOrder } = configMap[configType];

  let orderData = {};
  if (hasOrder) {
    const lastItem = await (model() as any).findFirst({
      select: { order: true },
      orderBy: { order: "desc" },
    });
    const nextPosition = lastItem
          ? (lastItem.order || 0) + 1
          : 0;
    orderData = { order: nextPosition };
  }

  const extraData: Record<string, any> = {};
  if (configType === "salesStage" && countInRevenue !== undefined) {
    extraData.countInRevenue = countInRevenue;
  }

  await (model() as any).create({
    data: {
      name: parsed,
      v: 0,
      ...orderData,
      ...extraData,
    },
    select: { id: true }
  });
  revalidatePath("/", "layout");
}

export async function updateConfigValue(
  configType: CrmConfigType,
  id: string,
  name: string,
  countInRevenue?: boolean
): Promise<void> {
  const parsed = nameSchema.parse(name);
  const { model } = configMap[configType];
  
  const data: Record<string, any> = { name: parsed };
  if (configType === "salesStage" && countInRevenue !== undefined) {
    data.countInRevenue = countInRevenue;
  }

  await (model() as any).update({ 
    where: { id }, 
    data,
    select: { id: true }
  });
  revalidatePath("/", "layout");
}

export async function deleteConfigValue(
  configType: CrmConfigType,
  id: string,
  replacementId?: string
): Promise<void> {
  if (replacementId !== undefined && replacementId === id) {
    throw new Error("replacementId must differ from id");
  }

  const { model, updateMany } = configMap[configType];

  if (configType === "salesStage") {
    const { firstStage, lostStage } = await getSalesStageCollections();
    if (id === firstStage?.id || id === lostStage?.id) {
      throw new Error("This stage is protected and cannot be deleted");
    }
  }

  if (replacementId && !updateMany) {
    throw new Error(`Config type does not support reassignment`);
  }
  const field = fkField[configType];

  if (replacementId && updateMany && field) {
    await prisma.$transaction([
      (updateMany() as any).updateMany({
        where: { [field]: id },
        data: { [field]: replacementId },
      }),
      (model() as any).delete({ where: { id } }),
    ]);
  } else {
    await (model() as any).delete({ where: { id } });
  }

  revalidatePath("/", "layout");
}

export async function reorderSalesStages(
  stages: ReorderSalesStageInput[]
): Promise<{ success: true }> {
  await requireCrmSettingsAccess();

  const parsed = reorderSalesStagesSchema.parse(stages);
  const uniqueIds = new Set(parsed.map((stage) => stage.id));

  if (uniqueIds.size !== parsed.length) {
    throw new Error("Sales stages must be unique");
  }

  const protectedStageIds = await prisma.crm_Opportunities_Sales_Stages.findMany({
    where: { order: -1 },
    select: { id: true },
  });
  const protectedIds = new Set(protectedStageIds.map((stage) => stage.id));

  if (parsed.some((stage) => protectedIds.has(stage.id))) {
    throw new Error("Protected sales stages cannot be reordered");
  }

  await prisma.$transaction(
    parsed.map((stage) =>
      prisma.crm_Opportunities_Sales_Stages.update({
        where: {
          id: stage.id,
        },
        data: {
          order: stage.position,
        },
        select: { id: true }
      })
    )
  );

  revalidatePath("/", "layout");
  return { success: true };
}
