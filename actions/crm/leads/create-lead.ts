"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { normalizeContactRole } from "@/lib/contact-options";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import {
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";
import { resolveLeadSourceId } from "@/lib/crm/contact-form-options";

export const createLead = async (data: {
  serial?: string;
  birthday_day?: string;
  birthday_month?: string;
  birthday_year?: string;
  first_name?: string;
  last_name: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  personal_email?: string;
  phone?: string;
  office_phone?: string;
  mobile_phone?: string;
  country?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  description?: string;
  website?: string;
  position?: string;
  status?: boolean;
  role?: string;
  contact_type_id?: string;
  lead_source_id?: string;
  lead_status_id?: string;
  lead_type_id?: string;
  refered_by?: string;
  campaign?: string;
  assigned_to?: string;
  assigned_account?: string;
  accountIDs?: string;
  social_twitter?: string;
  social_facebook?: string;
  social_linkedin?: string;
  social_skype?: string;
  social_instagram?: string;
  social_youtube?: string;
  social_tiktok?: string;
  productId?: string;
  custom_fields_data?: Record<string, string | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
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
    country,
    address_line1,
    address_line2,
    city,
    state,
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
    productId,
    custom_fields_data,
  } = data;

  const resolvedAddressLine1 = getAddressLine1(undefined, address_line1);
  const birthdayValue =
    birthday_day && birthday_month && birthday_year
      ? new Date(Number(birthday_year), Number(birthday_month) - 1, Number(birthday_day))
      : null;
  const resolvedLeadSourceId = await resolveLeadSourceId(lead_source_id);
  const leadCustomFields = await prismadb.custom_fields.findMany({
    orderBy: { createdAt: "asc" },
  });
  const sanitizedCustomFieldValues = sanitizeCustomFieldValues(
    custom_fields_data,
    leadCustomFields.filter((field) => fieldAppliesToEntity(field, "Lead")),
  );
  const supportedFields = await pickExistingDbModelFields("crm_Leads", {
    v: 1,
    serial: serial?.trim() || undefined,
    createdBy: userId,
    updatedBy: userId,
    firstName: first_name || "",
    lastName: last_name,
    company,
    jobTitle,
    email,
    personal_email,
    phone,
    office_phone,
    mobile_phone,
    country: country || undefined,
    address: resolvedAddressLine1 || undefined,
    address_line1: resolvedAddressLine1 || undefined,
    address_line2: address_line2 || undefined,
    city: city || undefined,
    state: state || undefined,
    postal_code: postal_code || undefined,
    description,
    website,
    position,
    status: status ?? true,
    role: normalizeContactRole(role),
    contact_type_id: contact_type_id || undefined,
    birthday: birthdayValue,
    lead_source_id: resolvedLeadSourceId,
    lead_status_id: lead_status_id || undefined,
    lead_type_id: lead_type_id || undefined,
    refered_by: refered_by || undefined,
    campaign: campaign || undefined,
    assigned_to: assigned_to || userId,
    accountsIDs: assigned_account || accountIDs || undefined,
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
  try {
    const lead = await prismadb.crm_Leads.create({
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
              : `Nová příležitost ${first_name} ${last_name} byla přidána do systému a přidělena vám.`,
          text:
            notifyRecipient.userLanguage === "en"
              ? `New lead ${first_name} ${last_name} has been added to the system and assigned to you. You can click here for detail: ${process.env.NEXT_PUBLIC_APP_URL}/crm/leads/${lead.id}`
              : `Nová příležitost ${first_name} ${last_name} byla přidána do systému a přidělena vám. Detaily naleznete zde: ${process.env.NEXT_PUBLIC_APP_URL}/crm/leads/${lead.id}`,
        });
      }
    }

    await writeAuditLog({
      entityType: "lead",
      entityId: lead.id,
      action: "created",
      changes: null,
      userId: session.user.id,
    });
    void inngest.send({ name: "crm/lead.saved", data: { record_id: lead.id } });
    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    return { data: lead };
  } catch (error: any) {
    console.log("[CREATE_LEAD] Error detail:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      data: {
        firstName: first_name,
        lastName: last_name,
        company,
        jobTitle,
        email,
        phone,
        personal_email,
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
        accountIDs,
        social_twitter,
        social_facebook,
        social_linkedin,
        social_skype,
        social_instagram,
        social_youtube,
        social_tiktok,
        productId,
        custom_fields_data,
      }
    });
    return { error: "Failed to create lead: " + (error.message || "Unknown error") };
  }
};
