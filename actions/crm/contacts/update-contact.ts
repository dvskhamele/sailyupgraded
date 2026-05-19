"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { normalizeContactRole } from "@/lib/contact-options";
import { getCrmContactDetailSelect } from "@/lib/prisma-contact-select";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { resolveContactTypeId, resolveLeadSourceId } from "@/lib/crm/contact-form-options";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { currencyInputToDecimalString } from "@/lib/currency-input";
import { normalizeContactNotes } from "@/lib/crm/notes";
import { parseOpportunityProducts, serializeOpportunityProducts } from "@/lib/opportunity-products";
import { connectUserById, resolveExistingUserId } from "@/lib/crm/resolve-user";
import { normalizeContactVisibility } from "@/lib/crm/contact-visibility";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import {
  type CustomFieldValue,
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";

function isMissingContactSerialColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("crm_contacts.serial") || message.toLowerCase().includes("crm_contacts`.`serial");
}

const DEFAULT_ONBOARDING_STAGE_NAME = "New Lead Intake";

async function ensureOnboardingSalesStage() {
  const existing = await prismadb.crm_Opportunities_Sales_Stages.findFirst({
    where: { name: DEFAULT_ONBOARDING_STAGE_NAME },
    select: { id: true },
  });

  if (existing) return existing;

  return prismadb.crm_Opportunities_Sales_Stages.create({
    data: {
      v: 0,
      name: DEFAULT_ONBOARDING_STAGE_NAME,
      probability: 0,
      order: 0,
    },
    select: { id: true },
  });
}

export const updateContact = async (data: {
  id: string;
  serial?: string | null;
  assigned_to?: string;
  assigned_account?: string | null;
  birthday_day?: string | null;
  birthday_month?: string | null;
  birthday_year?: string | null;
  description?: string | null;
  notes?: string | string[] | null;
  company?: string | null;
  jobTitle?: string | null;
  email?: string;
  personal_email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string;
  visible_to_name?: string | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  website?: string | null;
  country?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;

  postal_code?: string | null;
  position?: string | null;
  status?: boolean;
  role?: string | null;
  lead_source_id?: string | null;
  lead_status_id?: string | null;
  lead_type_id?: string | null;
  refered_by?: string | null;
  campaign?: string | null;
  social_twitter?: string | null;
  social_facebook?: string | null;
  social_linkedin?: string | null;
  social_skype?: string | null;
  social_instagram?: string | null;
  social_youtube?: string | null;
  social_tiktok?: string | null;
  contact_type_id?: string;
  opportunity_enabled?: boolean;
  opportunity_name?: string | null;
  opportunity_products?: string[];
  opportunity_budget?: string | null;
  opportunity_premium?: string | null;
  opportunity_stage_id?: string | null;
  opportunity_description?: string | null;
  custom_fields_data?: Record<string, CustomFieldValue | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    id,
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

  if (!id) return { error: "id is required" };

  const resolvedAddressLine1 = getAddressLine1(address, address_line1);
  const resolvedContactTypeId = await resolveContactTypeId(contact_type_id);
  const resolvedLeadSourceId = await resolveLeadSourceId(lead_source_id);
  const supportedAddressFields = await pickExistingDbModelFields("crm_Contacts", {
    country: country || null,
    address: resolvedAddressLine1 || null,
    address_line1: resolvedAddressLine1 || null,
    address_line2: address_line2 || null,
    city: city || null,
    state: state || null,
    postal_code: postal_code || null,
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
  const supportedUpdateFields = await pickExistingDbModelFields("crm_Contacts", {
    v: 0,
    serial: serial?.trim() || null,
    updatedBy: userId,
    accountsIDs: assigned_account || undefined,
    assigned_to: assigned_to || undefined,
    contact_type_id: resolvedContactTypeId,
    lead_source_id: resolvedLeadSourceId,
    lead_status_id: lead_status_id || null,
    lead_type_id: lead_type_id || null,
    birthday:
      birthday_day && birthday_month && birthday_year
        ? `${birthday_day}/${birthday_month}/${birthday_year}`
        : null,
    custom_fields_data:
      Object.keys(sanitizedCustomFieldValues).length > 0
        ? sanitizedCustomFieldValues
        : null,
    visible_to_name: normalizeContactVisibility(data.visible_to_name),
    ...(notes !== undefined && { notes: normalizeContactNotes(notes) }),
    ...supportedRoleFields,
    ...supportedAddressFields,
    ...rest,
  });

  try {
    const contactSelect = await getCrmContactDetailSelect();
    const before = await prismadb.crm_Contacts.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select: contactSelect,
    });
    if (!before) {
      return { error: "Contact not found" };
    }
    let contact;

    try {
      contact = await prismadb.crm_Contacts.update({
        where: { id },
        data: supportedUpdateFields as any,
        select: contactSelect,
      });
    } catch (error) {
      if (!isMissingContactSerialColumnError(error) || !("serial" in supportedUpdateFields)) {
        throw error;
      }

      const { serial: _serial, ...fallbackUpdateFields } = supportedUpdateFields as Record<string, unknown>;
      contact = await prismadb.crm_Contacts.update({
        where: { id },
        data: fallbackUpdateFields as any,
        select: contactSelect,
      });
    }

    const existingOpportunity = (before as any)?.opportunities
      ?.map((item: any) => item?.opportunity)
      .find(Boolean);
    const selectedProductValues = parseOpportunityProducts(opportunity_products);
    const opportunityBudgetAmount = currencyInputToDecimalString(opportunity_budget);
    const opportunityPremiumAmount = currencyInputToDecimalString(opportunity_premium);
    const resolvedOpportunityAssignedTo = await resolveExistingUserId(assigned_to, userId);
    const resolvedOpportunityCreatedBy = await resolveExistingUserId(userId);
    const hasOpportunityInput =
      Boolean(opportunity_enabled) &&
      Boolean(
        opportunity_name?.trim() ||
          selectedProductValues.length > 0 ||
          opportunity_budget?.trim() ||
          opportunity_premium?.trim() ||
          opportunity_stage_id?.trim() ||
          opportunity_description?.trim()
      );
    const selectedProducts = selectedProductValues.length
      ? await prismadb.crm_Products.findMany({
          where: {
            OR: selectedProductValues.flatMap((value) => [
              { id: value },
              { name: value },
            ]),
            deletedAt: null,
          },
          select: { name: true },
        })
      : [];
    const selectedProductNames =
      selectedProducts.length > 0
        ? selectedProducts.map((product) => product.name)
        : selectedProductValues;
    const resolvedOpportunityStageId = hasOpportunityInput
      ? opportunity_stage_id || (await ensureOnboardingSalesStage()).id
      : undefined;

    if (existingOpportunity && hasOpportunityInput) {
      const updatedOpportunity = await prismadb.crm_Opportunities.update({
        where: { id: existingOpportunity.id },
        data: {
          account: assigned_account || null,
          assigned_to: resolvedOpportunityAssignedTo,
          budget: opportunityBudgetAmount ?? 0,
          expected_revenue: opportunityPremiumAmount,
          category: serializeOpportunityProducts(selectedProductNames),
          description: opportunity_description || data.description || null,
          name: opportunity_name?.trim() || undefined,
          sales_stage: resolvedOpportunityStageId,
          updatedBy: userId,
          last_activity_by: userId,
        },
      });

      contact = {
        ...contact,
        opportunities: ((contact as any).opportunities ?? []).map((item: any) =>
          item?.opportunity?.id === existingOpportunity.id
            ? {
                ...item,
                opportunity: serializeDecimals({
                  ...item.opportunity,
                  ...updatedOpportunity,
                }),
              }
            : item,
        ),
      };
    } else if (hasOpportunityInput) {
      const opportunityName = [
        data.first_name,
        data.last_name,
        "Opportunity",
      ].filter(Boolean).join(" ");

      const opportunity = await prismadb.crm_Opportunities.create({
        data: {
          assigned_account: assigned_account
            ? { connect: { id: assigned_account } }
            : undefined,
          assigned_to_user: connectUserById(resolvedOpportunityAssignedTo),
          budget: opportunityBudgetAmount,
          expected_revenue: opportunityPremiumAmount,
          category: serializeOpportunityProducts(selectedProductNames),
          contact: contact.id,
          contacts: {
            create: {
              contact: { connect: { id: contact.id } },
            },
          },
          created_by_user: connectUserById(resolvedOpportunityCreatedBy),
          last_activity_by: userId,
          updatedBy: userId,
          description: opportunity_description || data.description || null,
          name: opportunity_name?.trim() || opportunityName,
          assigned_sales_stage: resolvedOpportunityStageId
            ? { connect: { id: resolvedOpportunityStageId } }
            : undefined,
          status: "ACTIVE",
        },
      });

      contact = {
        ...contact,
        opportunities: [
          ...((contact as any).opportunities ?? []),
          {
            opportunity: serializeDecimals(opportunity),
          },
        ],
      };
    }

    const changes = before ? diffObjects(before as Record<string, unknown>, contact as Record<string, unknown>) : null;
    await writeAuditLog({
      entityType: "contact",
      entityId: contact.id,
      action: "updated",
      changes,
      userId: session.user.id,
    });
    void inngest.send({ name: "crm/contact.saved", data: { record_id: contact.id } });
    revalidatePath("/[locale]/(routes)/crm/contacts", "page");
    return { data: serializeDecimals(contact) };
  } catch (error) {
    console.log("[UPDATE_CONTACT]", error);
    return { error: "Failed to update contact" };
  }
};
