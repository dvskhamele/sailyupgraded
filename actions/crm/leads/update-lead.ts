"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { normalizeContactRole } from "@/lib/contact-options";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import {
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";
import { resolveLeadSourceId } from "@/lib/crm/contact-form-options";

export const updateLead = async (data: {
  id: string;
  serial?: string | null;
  birthday_day?: string | null;
  birthday_month?: string | null;
  birthday_year?: string | null;
  first_name?: string | null;
  last_name: string;
  company?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  description?: string | null;
  website?: string | null;
  position?: string | null;
  status?: boolean;
  role?: string | null;
  contact_type_id?: string | null;
  lead_source_id?: string | null;
  lead_status_id?: string | null;
  lead_type_id?: string | null;
  refered_by?: string | null;
  campaign?: string | null;
  assigned_to?: string;
  assigned_account?: string | null;
  accountIDs?: string;
  social_twitter?: string | null;
  social_facebook?: string | null;
  social_linkedin?: string | null;
  social_skype?: string | null;
  social_instagram?: string | null;
  social_youtube?: string | null;
  social_tiktok?: string | null;
  custom_fields_data?: Record<string, string | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    id,
    serial,
    birthday_day,
    birthday_month,
    birthday_year,
    first_name,
    last_name,
    company,
    jobTitle,
    email,
    personal_email,
    phone,
    office_phone,
    mobile_phone,
    address_line1,
    address_line2,
    city,
    state,
    country,
    postal_code,
    description,
    website,
    position,
    status,
    role,
    contact_type_id,
    lead_source_id,
    lead_status_id,
    lead_type_id,
    refered_by,
    campaign,
    assigned_to,
    assigned_account,
    accountIDs,
    social_twitter,
    social_facebook,
    social_linkedin,
    social_skype,
    social_instagram,
    social_youtube,
    social_tiktok,
    custom_fields_data,
  } = data;

  if (!id) return { error: "id is required" };

  const resolvedAddressLine1 = getAddressLine1(undefined, address_line1);
  const birthdayValue =
    birthday_day && birthday_month && birthday_year
      ? new Date(Number(birthday_year), Number(birthday_month) - 1, Number(birthday_day))
      : null;
  const resolvedLeadSourceId = await resolveLeadSourceId(lead_source_id);

  try {
    const before = await prismadb.crm_Leads.findUnique({ where: { id, deletedAt: null } });
    const leadCustomFields = await prismadb.custom_fields.findMany({
      orderBy: { createdAt: "asc" },
    });
    const sanitizedCustomFieldValues = sanitizeCustomFieldValues(
      custom_fields_data,
      leadCustomFields.filter((field) => fieldAppliesToEntity(field, "Lead")),
    );
    const supportedFields = await pickExistingDbModelFields("crm_Leads", {
      v: 1,
      serial: serial ? Number(serial) : null,
      updatedBy: userId,
      firstName: first_name || undefined,
      lastName: last_name,
      company,
      jobTitle,
      email,
      personal_email,
      phone,
      office_phone,
      mobile_phone,
      address: resolvedAddressLine1 || null,
      address_line1: resolvedAddressLine1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      state: state || null,
      country: country || null,
      postal_code: postal_code || null,
      description,
      website,
      position,
      status: status ?? true,
      role: normalizeContactRole(role),
      contact_type_id: contact_type_id || null,
      birthday: birthdayValue,
      lead_source_id: resolvedLeadSourceId,
      lead_status_id: lead_status_id || undefined,
      lead_type_id: lead_type_id || undefined,
      refered_by,
      campaign,
      assigned_to: assigned_to || userId,
      accountsIDs: assigned_account || accountIDs,
      custom_fields_data:
        Object.keys(sanitizedCustomFieldValues).length > 0
          ? sanitizedCustomFieldValues
          : null,
      social_twitter,
      social_facebook,
      social_linkedin,
      social_skype,
      social_instagram,
      social_youtube,
      social_tiktok,
    });

    const lead = await prismadb.crm_Leads.update({
      where: { id },
      data: supportedFields as any,
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
              ? `New lead ${first_name} ${last_name} has been added to the system and assigned to you.`
              : `NovÃ¡ pÅ™Ã­leÅ¾itost ${first_name} ${last_name} byla pÅ™idÃ¡na do systÃ©mu a pÅ™idÄ›lena vÃ¡m.`,
          text:
            notifyRecipient.userLanguage === "en"
              ? `New lead ${first_name} ${last_name} has been added to the system and assigned to you. You can click here for detail: ${process.env.NEXT_PUBLIC_APP_URL}/crm/leads/${lead.id}`
              : `NovÃ¡ pÅ™Ã­leÅ¾itost ${first_name} ${last_name} byla pÅ™idÃ¡na do systÃ©mu a pÅ™idÄ›lena vÃ¡m. Detaily naleznete zde: ${process.env.NEXT_PUBLIC_APP_URL}/crm/leads/${lead.id}`,
        });
      }
    }

    const changes = before ? diffObjects(before as Record<string, unknown>, lead as Record<string, unknown>) : null;
    await writeAuditLog({
      entityType: "lead",
      entityId: lead.id,
      action: "updated",
      changes,
      userId: session.user.id,
    });
    void inngest.send({ name: "crm/lead.saved", data: { record_id: lead.id } });
    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    return { data: lead };
  } catch (error) {
    console.log("[UPDATE_LEAD]", error);
    return { error: "Failed to update lead" };
  }
};
