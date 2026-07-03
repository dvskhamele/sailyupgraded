"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { CreateProduct } from "./schema";
import { InputType, ReturnType } from "./types";
import { createSafeAction } from "@/lib/create-safe-action";
import { writeAuditLog } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { currencyInputToDecimalString, currencyInputToNumber } from "@/lib/currency-input";

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
  const {
    name, description, sku, type, status, unit_price, unit_cost,
    currency, tax_rate, unit, is_recurring, billing_period, categoryId,
  } = data;

  if (is_recurring && !billing_period) {
    return { error: "Billing period is required for recurring products" };
  }

  try {
    const parsedUnitPrice = currencyInputToDecimalString(unit_price);
    if (!parsedUnitPrice || Number(parsedUnitPrice) < 0) {
      return { error: "Valid unit price is required" };
    }

    const parsedUnitCost = currencyInputToNumber(unit_cost);
    if (
      parsedUnitCost !== undefined &&
      (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)
    ) {
      return { error: "Unit cost must be a valid non-negative number" };
    }

    const parsedTaxRate =
      tax_rate && tax_rate.trim() !== "" ? Number(tax_rate) : undefined;
    if (
      parsedTaxRate !== undefined &&
      (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100)
    ) {
      return { error: "Tax rate must be between 0 and 100" };
    }

    if (sku) {
      const existing = await prismadb.crm_Products.findUnique({ where: { sku } });
      if (existing) {
        return { error: `A product with SKU "${sku}" already exists` };
      }
    }

    const product = await prismadb.crm_Products.create({
      data: {
        organizationId,
        name,
        description: description?.trim() || null,
        sku: sku?.trim() || null,
        type,
        status: status || "DRAFT",
        unit_price: parsedUnitPrice,
        unit_cost: parsedUnitCost ?? null,
        assigned_currency: { connect: { code: currency } },
        tax_rate: parsedTaxRate ?? null,
        unit: unit?.trim() || null,
        is_recurring: is_recurring || false,
        billing_period: is_recurring ? billing_period : null,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        created_by_user: { connect: { id: userId } },
        updatedBy: userId,
      },
    });

    await writeAuditLog({
      entityType: "product",
      entityId: product.id,
      action: "created",
      changes: null,
      userId,
    });

    revalidatePath("/[locale]/crm/products", "page");
    revalidatePath("/[locale]/crm/dashboard", "page");
    return { data: { id: product.id, name: product.name } };
  } catch (error) {
    console.log("[CREATE_PRODUCT]", error);
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Failed to create product",
    };
  }
};

export const createProduct = createSafeAction(CreateProduct, handler);
