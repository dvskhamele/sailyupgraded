"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import { getSnapshotRate, getDefaultCurrency } from "@/lib/currency";
import {
  type CustomFieldValue,
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { serializeOpportunityProducts } from "@/lib/opportunity-products";
import { Prisma } from "@prisma/client";
import { currencyInputToDecimalString } from "@/lib/currency-input";
import { resolveExistingUserId } from "@/lib/crm/resolve-user";

export const updateOpportunity = async (data: {
  id: string;
  account?: string;
  assigned_to?: string;
  budget?: string;
  campaign?: string | null;
  clientName?: string;
  close_date?: Date;
  contact?: string;
  currency?: string;
  description?: string;
  expected_revenue?: string;
  name?: string;
  next_step?: string;
  sales_stage?: string;
  type?: string;
  category?: string[] | string;
  custom_fields_data?: Record<string, CustomFieldValue | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    id,
    account,
    assigned_to,
    budget,
    campaign,
    clientName,
    close_date,
    contact,
    currency,
    description,
    expected_revenue,
    name,
    next_step,
    sales_stage,
    type,
    category,
    custom_fields_data,
  } = data;

  if (!id) return { error: "id is required" };

  try {
    const defaultCurrency = await getDefaultCurrency();
    const budgetAmount = currencyInputToDecimalString(budget);
    const expectedRevenueAmount = currencyInputToDecimalString(expected_revenue);
    const resolvedAssignedTo = await resolveExistingUserId(assigned_to);
    const resolvedCurrency = currency || "USD";
    const snapshotRate = resolvedCurrency
      ? await getSnapshotRate(resolvedCurrency, defaultCurrency)
      : null;
    const opportunityCustomFields = await prismadb.custom_fields.findMany({
      orderBy: { createdAt: "asc" },
    });
    const sanitizedCustomFieldValues = sanitizeCustomFieldValues(
      custom_fields_data,
      opportunityCustomFields.filter((field) =>
        fieldAppliesToEntity(field, "Opportunity"),
      ),
    );
    const supportedCustomFieldData = await pickExistingDbModelFields(
      "crm_Opportunities",
      {
        custom_fields_data:
          Object.keys(sanitizedCustomFieldValues).length > 0
            ? sanitizedCustomFieldValues
            : Prisma.JsonNull,
      },
    );

    const before = await prismadb.crm_Opportunities.findFirst({ 
      where: { id, deletedAt: null } 
    });

    const opportunity = await prismadb.crm_Opportunities.update({
      where: { id },
      data: {
        assigned_account: account ? { connect: { id: account } } : { disconnect: true },
        assigned_to_user: resolvedAssignedTo ? { connect: { id: resolvedAssignedTo } } : { disconnect: true },
        budget: budgetAmount,
        assigned_campaings: campaign ? { connect: { id: campaign } } : { disconnect: true },
        category: serializeOpportunityProducts(category),
        clientName: clientName || null,
        close_date,
        contact: contact || null,
        updatedBy: userId,
        assigned_currency: resolvedCurrency ? { connect: { code: resolvedCurrency } } : { disconnect: true },
        description: description || null,
        expected_revenue: expectedRevenueAmount,
        snapshot_rate: snapshotRate ? parseFloat(snapshotRate.toString()) : undefined,
        name: name || undefined,
        next_step: next_step || null,
        assigned_sales_stage: sales_stage ? { connect: { id: sales_stage } } : { disconnect: true },
        status: "ACTIVE",
        assigned_type: type ? { connect: { id: type } } : { disconnect: true },
        ...supportedCustomFieldData,
      },
    });

    const serialize = (obj: any) =>
      JSON.parse(
        JSON.stringify(obj, (_, value) => (typeof value === "bigint" ? value.toString() : value))
      );

    const changes = before ? diffObjects(serialize(before), serialize(opportunity)) : null;

    await writeAuditLog({
      entityType: "opportunity",
      entityId: opportunity.id,
      action: "updated",
      changes,
      userId: session.user.id,
    });

    void inngest.send({ name: "crm/opportunity.saved", data: { record_id: opportunity.id } });
    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");

    return { data: serializeDecimals(opportunity) };
  } catch (error: any) {
    console.log(error);
    return { error: error.message };
  }
};
