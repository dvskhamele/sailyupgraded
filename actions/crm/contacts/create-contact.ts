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
import { resolveLeadSourceId } from "@/lib/crm/contact-form-options";
import {
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";

function isMissingContactSerialColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("crm_contacts.serial") || message.toLowerCase().includes("crm_contacts`.`serial");
}

export const createContact = async (data: {
  serial?: string;
  assigned_to?: string;
  assigned_account?: string;
  birthday_day?: string;
  birthday_month?: string;
  birthday_year?: string;
  description?: string;
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
  address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
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

  const resolvedAddressLine1 = getAddressLine1(address, address_line1);
  const resolvedLeadSourceId = await resolveLeadSourceId(lead_source_id);
  const supportedAddressFields = await pickExistingDbModelFields("crm_Contacts", {
    address: resolvedAddressLine1 || undefined,
    address_line1: resolvedAddressLine1 || undefined,
    address_line2: address_line2 || undefined,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
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
    serial: serial ? Number(serial) : undefined,
    createdBy: userId,
    updatedBy: userId,
    accountsIDs: assigned_account || undefined,
    assigned_to: assigned_to || undefined,
    contact_type_id: contact_type_id || undefined,
    lead_source_id: resolvedLeadSourceId,
    lead_status_id: lead_status_id || undefined,
    lead_type_id: lead_type_id || undefined,
    tags: [],
    notes: {},
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
    let contact;

    try {
      contact = await prismadb.crm_Contacts.create({
        data: supportedCreateFields as any,
        select: contactSelect,
      });
    } catch (error) {
      if (!isMissingContactSerialColumnError(error) || !("serial" in supportedCreateFields)) {
        throw error;
      }

      const { serial: _serial, ...fallbackCreateFields } = supportedCreateFields as Record<string, unknown>;
      contact = await prismadb.crm_Contacts.create({
        data: fallbackCreateFields as any,
        select: contactSelect,
      });
    }

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
    return { data: contact };
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
