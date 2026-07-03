"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getSnapshotRate, getDefaultCurrency } from "@/lib/currency";
import {
  type CustomFieldValue,
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { serializeOpportunityProducts } from "@/lib/opportunity-products";
import { currencyInputToDecimalString } from "@/lib/currency-input";
import { connectUserById, resolveExistingUserId } from "@/lib/crm/resolve-user";

export const createOpportunity = async (data: {
  account?: string;
  assigned_to?: string;
  budget?: string;
  campaign?: string;
  clientName?: string;
  close_date?: Date;
  contact?: string;
  currency?: string;
  description?: string;
  expected_revenue?: string;
  name: string;
  next_step?: string;
  sales_stage?: string;
  type?: string;
  category?: string[] | string;
  custom_fields_data?: Record<string, CustomFieldValue | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (!session.user.organizationId) {
    return { error: "Organization context is required" };
  }

  const userId = session.user.id;
  const organizationId = session.user.organizationId;
  const {
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

  try {
    const defaultCurrency = await getDefaultCurrency();
    const budgetAmount = currencyInputToDecimalString(budget);
    const expectedRevenueAmount = currencyInputToDecimalString(expected_revenue);
    const resolvedAssignedTo = await resolveExistingUserId(assigned_to, userId);
    const resolvedCreatedBy = await resolveExistingUserId(userId);
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
            : undefined,
      },
    );

    const opportunity = await prismadb.crm_Opportunities.create({
      data: {
        organizationId,
        assigned_account: account ? { connect: { id: account } } : undefined,
        assigned_to_user: connectUserById(resolvedAssignedTo),
        budget: budgetAmount,
        assigned_campaings: campaign ? { connect: { id: campaign } } : undefined,
        category: serializeOpportunityProducts(category),
        clientName: clientName?.trim() || null,
        close_date: close_date || null,
        contact: contact || null,
        created_by_user: connectUserById(resolvedCreatedBy),
        last_activity_by: userId,
        updatedBy: userId,
        assigned_currency: resolvedCurrency ? { connect: { code: resolvedCurrency } } : undefined,
        description: description || null,
        expected_revenue: expectedRevenueAmount,
        snapshot_rate: snapshotRate ? parseFloat(snapshotRate.toString()) : null,
        name,
        next_step: next_step || null,
        assigned_sales_stage: sales_stage ? { connect: { id: sales_stage } } : undefined,
        status: "ACTIVE",
        assigned_type: type ? { connect: { id: type } } : undefined,
        ...supportedCustomFieldData,
      },
    });

    if (resolvedAssignedTo && resolvedAssignedTo !== userId) {
      const notifyRecipient = await prismadb.users.findFirst({
        where: { id: resolvedAssignedTo },
      });

      if (notifyRecipient) {
        await sendEmail({
          from: process.env.EMAIL_FROM as string,
          to: notifyRecipient.email || "info@softbase.cz",
          subject:
            notifyRecipient.userLanguage === "en"
              ? `New opportunity ${name} has been added to the system and assigned to you.`
              : `Nová příležitost ${name} byla přidána do systému a přidělena vám.`,
          text:
            notifyRecipient.userLanguage === "en"
              ? `New opportunity ${name} has been added to the system and assigned to you. You can click here for detail: ${process.env.NEXT_PUBLIC_APP_URL}/crm/opportunities/${opportunity.id}`
              : `Nová příležitost ${name} byla přidána do systému a přidělena vám. Detaily naleznete zde: ${process.env.NEXT_PUBLIC_APP_URL}/crm/opportunities/${opportunity.id}`,
        });
      }
    }

    await writeAuditLog({
      entityType: "opportunity",
      entityId: opportunity.id,
      action: "created",
      changes: null,
      userId: session.user.id,
    });
    void inngest
      .send({ name: "crm/opportunity.saved", data: { record_id: opportunity.id } })
      .catch((error) => {
        console.error("[CREATE_OPPORTUNITY_INGGEST]", error);
      });
    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");
    return { data: serializeDecimals(opportunity) };
  } catch (error: any) {
    console.log("[CREATE_OPPORTUNITY]", error);
    return { error: error.message || "Failed to create opportunity" };
  }
};
