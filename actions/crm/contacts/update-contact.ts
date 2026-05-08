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
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
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
    address,
    address_line1,
    address_line2,
    city,
    state,
    country,
    postal_code,
    custom_fields_data,
    ...rest
  } = data;

  if (!id) return { error: "id is required" };

  const resolvedAddressLine1 = getAddressLine1(address, address_line1);
  const resolvedLeadSourceId = await resolveLeadSourceId(lead_source_id);
  const supportedAddressFields = await pickExistingDbModelFields("crm_Contacts", {
    address: resolvedAddressLine1 || null,
    address_line1: resolvedAddressLine1 || null,
    address_line2: address_line2 || null,
    city: city || null,
    state: state || null,
    country: country || null,
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
    serial: serial ? Number(serial) : null,
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
    return { data: contact };
  } catch (error) {
    console.log("[UPDATE_CONTACT]", error);
    return { error: "Failed to update contact" };
  }
};
