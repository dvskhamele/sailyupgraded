"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { AssignProduct } from "./schema";
import { InputType, ReturnType } from "./types";
import { createSafeAction } from "@/lib/create-safe-action";
import { writeAuditLog } from "@/lib/audit-log";
import { getSnapshotRate, getDefaultCurrency } from "@/lib/currency";
import { revalidatePath } from "next/cache";
import { currencyInputToDecimalString } from "@/lib/currency-input";

const handler = async (data: InputType): Promise<ReturnType> => {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  if (!session.user.organizationId) {
    return { error: "Organization context is required" };
  }

  const userId = session.user.id;
  const organizationId = session.user.organizationId;
  const { accountId, productId, quantity, custom_price, currency, status, start_date, end_date, renewal_date, notes } = data;

  try {
    const product = await prismadb.crm_Products.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) {
      return { error: "Product not found" };
    }
    if (product.status !== "ACTIVE") {
      return { error: "Only active products can be assigned to accounts" };
    }

    const existingAssignment = await prismadb.crm_AccountProducts.findFirst({
      where: { accountId, productId, status: { in: ["ACTIVE", "PENDING"] } },
    });
    if (existingAssignment) {
      return { error: "This product is already assigned to this account with an active or pending status" };
    }

    if (end_date && end_date <= start_date) {
      return { error: "End date must be after start date" };
    }
    if (renewal_date && renewal_date <= start_date) {
      return { error: "Renewal date must be after start date" };
    }

    const defaultCurrency = await getDefaultCurrency();
    const snapshotRate = currency ? await getSnapshotRate(currency, defaultCurrency) : null;
    const customPriceAmount = currencyInputToDecimalString(custom_price);

    const assignment = await prismadb.crm_AccountProducts.create({
      data: {
        organizationId,
        accountId, productId, quantity,
        custom_price: customPriceAmount,
        currency,
        snapshot_rate: snapshotRate ? parseFloat(snapshotRate.toString()) : undefined,
        status: status || "ACTIVE",
        start_date,
        end_date: end_date || undefined,
        renewal_date: renewal_date || undefined,
        notes: notes || undefined,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await writeAuditLog({ entityType: "account_product", entityId: assignment.id, action: "created", changes: null, userId });

    revalidatePath("/[locale]/(routes)/crm/accounts/[accountId]", "page");
    revalidatePath("/[locale]/(routes)/crm/products/[productId]", "page");
    return { data: { id: assignment.id } };
  } catch (error) {
    console.log("[ASSIGN_PRODUCT]", error);
    return { error: "Failed to assign product to account" };
  }
};

export const assignProduct = createSafeAction(AssignProduct, handler);
