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
import { resolveLeadSourceId } from "@/lib/crm/contact-form-options";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { serializeOpportunityProducts } from "@/lib/opportunity-products";
import {
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";

function isMissingContactSerialColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("crm_contacts.serial") || message.toLowerCase().includes("crm_contacts`.`serial");
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
  company?: string | null;
  jobTitle?: string | null;
  email?: string;
  personal_email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string;
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
  opportunity_products?: string[];
  opportunity_budget?: string | null;
  custom_fields_data?: Record<string, string | null | undefined>;
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
    opportunity_products,
    opportunity_budget,
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
    contact_type_id: contact_type_id || undefined,
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
    ...supportedRoleFields,
    ...supportedAddressFields,
    ...rest,
  });

  try {
    const contactSelect = await getCrmContactDetailSelect();
    const before = await prismadb.crm_Contacts.findUnique({
      where: { id, deletedAt: null },
      select: contactSelect,
    });
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
    const hasOpportunityInput = (opportunity_products?.length ?? 0) > 0 || Boolean(opportunity_budget?.trim());

    if (existingOpportunity) {
      const updatedOpportunity = await prismadb.crm_Opportunities.update({
        where: { id: existingOpportunity.id },
        data: {
          account: assigned_account || null,
          assigned_to: assigned_to || userId,
          budget: opportunity_budget?.trim() ? parseFloat(opportunity_budget) : 0,
          category: serializeOpportunityProducts(opportunity_products),
          description: data.description || null,
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
          assigned_to_user: { connect: { id: assigned_to || userId } },
          budget: opportunity_budget ? parseFloat(opportunity_budget) : undefined,
          category: serializeOpportunityProducts(opportunity_products),
          contact: contact.id,
          contacts: {
            create: {
              contact: { connect: { id: contact.id } },
            },
          },
          created_by_user: { connect: { id: userId } },
          last_activity_by: userId,
          updatedBy: userId,
          description: data.description || null,
          name: opportunityName,
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
