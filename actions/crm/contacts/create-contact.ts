"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { normalizeContactRole } from "@/lib/contact-options";
import { getCrmContactDetailSelect } from "@/lib/prisma-contact-select";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { resolveContactTypeId, resolveLeadSourceId } from "@/lib/crm/contact-form-options";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { currencyInputToDecimalString } from "@/lib/currency-input";
import { normalizeContactNotes } from "@/lib/crm/notes";
import { parseOpportunityProducts, serializeOpportunityProducts } from "@/lib/opportunity-products";
import {
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";

function isMissingContactSerialColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("crm_contacts.serial") || message.toLowerCase().includes("crm_contacts`.`serial");
}

const DEFAULT_ONBOARDING_STAGE_NAME = "New Lead Intake";

async function ensureOnboardingSalesStage(tx: any) {
  const existing = await tx.crm_Opportunities_Sales_Stages.findFirst({
    where: { name: DEFAULT_ONBOARDING_STAGE_NAME },
    select: { id: true },
  });

  if (existing) return existing;

  return tx.crm_Opportunities_Sales_Stages.create({
    data: {
      v: 0,
      name: DEFAULT_ONBOARDING_STAGE_NAME,
      probability: 0,
      order: 0,
    },
    select: { id: true },
  });
}

export const createContact = async (data: {
  serial?: string;
  assigned_to?: string;
  assigned_account?: string;
  birthday_day?: string;
  birthday_month?: string;
  birthday_year?: string;
  description?: string;
  notes?: string | string[] | null;
  company?: string;
  jobTitle?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  first_name?: string;
  last_name: string;
  office_phone?: string;
  mobile_phone?: string;
  website?: string;
  country?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  position?: string;
  status?: boolean;
  role?: string;
  lead_source_id?: string;
  lead_status_id?: string;
  lead_type_id?: string;
  refered_by?: string;
  campaign?: string;
  social_twitter?: string;
  social_facebook?: string;
  social_linkedin?: string;
  social_skype?: string;
  social_instagram?: string;
  social_youtube?: string;
  social_tiktok?: string;
  contact_type_id?: string;
  opportunity_enabled?: boolean;
  opportunity_name?: string;
  opportunity_products?: string[];
  opportunity_budget?: string;
  opportunity_premium?: string;
  opportunity_stage_id?: string;
  opportunity_description?: string;
  custom_fields_data?: Record<string, string | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    serial,
    assigned_to,
    assigned_account,
    birthday_day,
    birthday_month,
    birthday_year,
    contact_type_id,
    lead_source_id,
    lead_status_id,
    lead_type_id,
    opportunity_enabled,
    opportunity_name,
    opportunity_products,
    opportunity_budget,
    opportunity_premium,
    opportunity_stage_id,
    opportunity_description,
    notes,
    country,
    address,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    custom_fields_data,
    ...rest
  } = data;

  const resolvedAddressLine1 = getAddressLine1(address, address_line1);
  const resolvedContactTypeId = await resolveContactTypeId(contact_type_id);
  const resolvedLeadSourceId = await resolveLeadSourceId(lead_source_id);
  const supportedAddressFields = await pickExistingDbModelFields("crm_Contacts", {
    country: country || undefined,
    address: resolvedAddressLine1 || undefined,
    address_line1: resolvedAddressLine1 || undefined,
    address_line2: address_line2 || undefined,
    city: city || undefined,
    state: state || undefined,
    postal_code: postal_code || undefined,
  });
  const supportedRoleFields = await pickExistingDbModelFields("crm_Contacts", {
    role: normalizeContactRole(data.role),
  });
  const contactCustomFields = await prismadb.custom_fields.findMany({
    orderBy: { createdAt: "asc" },
  });
  const sanitizedCustomFieldValues = sanitizeCustomFieldValues(
    custom_fields_data,
    contactCustomFields.filter((field) => fieldAppliesToEntity(field, "Contact", data.role)),
  );
  const supportedCreateFields = await pickExistingDbModelFields("crm_Contacts", {
    v: 1,
    serial: serial?.trim() || undefined,
    createdBy: userId,
    updatedBy: userId,
    accountsIDs: assigned_account || undefined,
    assigned_to: assigned_to || undefined,
    contact_type_id: resolvedContactTypeId,
    lead_source_id: resolvedLeadSourceId,
    lead_status_id: lead_status_id || undefined,
    lead_type_id: lead_type_id || undefined,
    tags: [],
    notes: normalizeContactNotes(notes),
    birthday:
      birthday_day && birthday_month && birthday_year
        ? `${birthday_day}/${birthday_month}/${birthday_year}`
        : null,
    custom_fields_data:
      Object.keys(sanitizedCustomFieldValues).length > 0
        ? sanitizedCustomFieldValues
        : null,
    ...supportedRoleFields,
    ...supportedAddressFields,
    ...rest,
  });

  try {
    const contactSelect = await getCrmContactDetailSelect();
    const selectedProductValues = parseOpportunityProducts(opportunity_products);
    const opportunityBudgetAmount = currencyInputToDecimalString(opportunity_budget);
    const opportunityPremiumAmount = currencyInputToDecimalString(opportunity_premium);
    const shouldCreateOpportunity =
      Boolean(opportunity_enabled) &&
      Boolean(
        opportunity_name?.trim() ||
          selectedProductValues.length > 0 ||
          opportunity_budget?.trim() ||
          opportunity_premium?.trim() ||
          opportunity_stage_id?.trim() ||
          opportunity_description?.trim()
      );

    const contact = await prismadb.$transaction(async (tx) => {
      let createdContact;

      try {
        createdContact = await tx.crm_Contacts.create({
          data: supportedCreateFields as any,
          select: contactSelect,
        });
      } catch (error) {
        if (!isMissingContactSerialColumnError(error) || !("serial" in supportedCreateFields)) {
          throw error;
        }

        const { serial: _serial, ...fallbackCreateFields } = supportedCreateFields as Record<string, unknown>;
        createdContact = await tx.crm_Contacts.create({
          data: fallbackCreateFields as any,
          select: contactSelect,
        });
      }

      if (!shouldCreateOpportunity) {
        return createdContact;
      }

      const onboardingStage = opportunity_stage_id
        ? { id: opportunity_stage_id }
        : await ensureOnboardingSalesStage(tx);
      const selectedProducts = await tx.crm_Products.findMany({
        where: {
          OR: selectedProductValues.flatMap((value) => [
            { id: value },
            { name: value },
          ]),
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          unit_price: true,
          currency: true,
        },
      });
      const selectedProductNames =
        selectedProducts.length > 0
          ? selectedProducts.map((product: any) => product.name)
          : selectedProductValues;
      const opportunityName = [
        [data.first_name, data.last_name].filter(Boolean).join(" "),
        selectedProductNames[0],
      ].filter(Boolean).join(" - ") || "Opportunity";
      const opportunity = await tx.crm_Opportunities.create({
        data: {
          assigned_account: assigned_account
            ? { connect: { id: assigned_account } }
            : undefined,
          assigned_to_user: { connect: { id: assigned_to || userId } },
          budget: opportunityBudgetAmount,
          expected_revenue: opportunityPremiumAmount,
          category: serializeOpportunityProducts(selectedProductNames),
          contact: createdContact.id,
          contacts: {
            create: {
              contact: { connect: { id: createdContact.id } },
            },
          },
          created_by_user: { connect: { id: userId } },
          last_activity_by: userId,
          updatedBy: userId,
          description: opportunity_description || data.description || null,
          name: opportunity_name?.trim() || opportunityName,
          assigned_sales_stage: { connect: { id: onboardingStage.id } },
          status: "ACTIVE",
          lineItems:
            selectedProducts.length > 0
              ? {
                  create: selectedProducts.map((product: any, index: number) => ({
                    product: { connect: { id: product.id } },
                    name: product.name,
                    sku: product.sku,
                    description: product.description,
                    quantity: 1,
                    unit_price: product.unit_price,
                    line_total: product.unit_price,
                    currency: product.currency,
                    sort_order: index,
                    createdBy: userId,
                    updatedBy: userId,
                  })),
                }
              : undefined,
        },
        select: {
          id: true,
          name: true,
          sales_stage: true,
          close_date: true,
          budget: true,
          expected_revenue: true,
          category: true,
          currency: true,
          description: true,
        },
      });

      return {
        ...createdContact,
        opportunities: [
          ...((createdContact as any).opportunities ?? []),
          {
            opportunity: serializeDecimals(opportunity),
          },
        ],
      };
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
              ? `New contact ${data.first_name} ${data.last_name} has been added to the system and assigned to you.`
              : `Nový kontakt ${data.first_name} ${data.last_name} byla přidána do systému a přidělena vám.`,
          text:
            notifyRecipient.userLanguage === "en"
              ? `New contact ${data.first_name} ${data.last_name} has been added to the system and assigned to you. You can click here for detail: ${process.env.NEXT_PUBLIC_APP_URL}/crm/contacts/${contact.id}`
              : `Nový kontakt ${data.first_name} ${data.last_name} byla přidán do systému a přidělena vám. Detaily naleznete zde: ${process.env.NEXT_PUBLIC_APP_URL}/crm/contact/${contact.id}`,
        });
      }
    }

    await writeAuditLog({
      entityType: "contact",
      entityId: contact.id,
      action: "created",
      changes: null,
      userId: session.user.id,
    });
    void inngest.send({ name: "crm/contact.saved", data: { record_id: contact.id } });
    revalidatePath("/[locale]/crm/contacts", "page");
    revalidatePath("/[locale]/crm/opportunities", "page");
    return { data: serializeDecimals(contact) };
  } catch (error: any) {
    console.log("[CREATE_CONTACT] Error detail:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      data: {
        assigned_to,
        assigned_account,
        contact_type_id,
        custom_fields_data,
        ...rest
      }
    });
    return { error: "Failed to create contact: " + (error.message || "Unknown error") };
  }
};
