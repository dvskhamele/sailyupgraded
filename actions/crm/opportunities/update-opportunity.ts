"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import { getSnapshotRate, getDefaultCurrency } from "@/lib/currency";
import { serializeDecimals } from "@/lib/serialize-decimals";

export const updateOpportunity = async (data: {
  id: string;
  account?: string;
  assigned_to?: string;
  budget?: string;
  campaign?: string | null;
  category?: string;
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

  if (!id) return { error: "id is required" };

  try {
    const defaultCurrency = await getDefaultCurrency();
    const snapshotRate = currency
      ? await getSnapshotRate(currency, defaultCurrency)
      : null;

    const before = await prismadb.crm_Opportunities.findFirst({ 
      where: { id, deletedAt: null } 
    });

    const opportunity = await prismadb.crm_Opportunities.update({
      where: { id },
      data: {
        assigned_account: account ? { connect: { id: account } } : { disconnect: true },
        assigned_to_user: assigned_to ? { connect: { id: assigned_to } } : { disconnect: true },
        budget: budget ? parseFloat(budget) : undefined,
        assigned_campaings: campaign ? { connect: { id: campaign } } : { disconnect: true },
        category: category || null,
        clientName: clientName || null,
        close_date,
        contact: contact || null,
        updatedBy: userId,
        assigned_currency: currency ? { connect: { code: currency } } : { disconnect: true },
        description: description || null,
        expected_revenue: expected_revenue ? parseFloat(expected_revenue) : undefined,
        snapshot_rate: snapshotRate ? parseFloat(snapshotRate.toString()) : undefined,
        name: name || undefined,
        next_step: next_step || null,
        assigned_sales_stage: sales_stage ? { connect: { id: sales_stage } } : { disconnect: true },
        status: "ACTIVE",
        assigned_type: type ? { connect: { id: type } } : { disconnect: true },
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
