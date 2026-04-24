"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getSnapshotRate, getDefaultCurrency } from "@/lib/currency";
import { serializeDecimals } from "@/lib/serialize-decimals";

export const createOpportunity = async (data: {
  account?: string;
  assigned_to?: string;
  budget?: string;
  campaign?: string;
  category?: string;
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
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    account,
    assigned_to,
    budget,
    campaign,
    category,
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
  } = data;

  try {
    const defaultCurrency = await getDefaultCurrency();
    const snapshotRate = currency
      ? await getSnapshotRate(currency, defaultCurrency)
      : null;

    const opportunity = await prismadb.crm_Opportunities.create({
      data: {
        assigned_account: account ? { connect: { id: account } } : undefined,
        assigned_to_user: { connect: { id: assigned_to || userId } },
        budget: budget ? parseFloat(budget) : undefined,
        assigned_campaings: campaign ? { connect: { id: campaign } } : undefined,
        category: category?.trim() || null,
        clientName: clientName?.trim() || null,
        close_date: close_date || null,
        contact: contact || null,
        created_by_user: { connect: { id: userId } },
        last_activity_by: userId,
        updatedBy: userId,
        assigned_currency: currency ? { connect: { code: currency } } : undefined,
        description: description || null,
        expected_revenue: expected_revenue ? parseFloat(expected_revenue) : undefined,
        snapshot_rate: snapshotRate ? parseFloat(snapshotRate.toString()) : null,
        name,
        next_step: next_step || null,
        assigned_sales_stage: sales_stage ? { connect: { id: sales_stage } } : undefined,
        status: "ACTIVE",
        assigned_type: type ? { connect: { id: type } } : undefined,
      },
    });

    if (assigned_to && assigned_to !== userId) {
      const notifyRecipient = await prismadb.users.findFirst({
        where: { id: assigned_to },
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
