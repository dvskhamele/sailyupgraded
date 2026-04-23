"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { pickSupportedModelFields } from "@/lib/prisma-model-fields";

export const createLead = async (data: {
  first_name?: string;
  last_name: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  description?: string;
  lead_source_id?: string;
  lead_status_id?: string;
  lead_type_id?: string;
  refered_by?: string;
  campaign?: string;
  assigned_to?: string;
  accountIDs?: string;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    first_name,
    last_name,
    company,
    jobTitle,
    email,
    phone,
    address_line1,
    address_line2,
    city,
    state,
    country,
    postal_code,
    description,
    lead_source_id,
    lead_status_id,
    lead_type_id,
    refered_by,
    campaign,
    assigned_to,
    accountIDs,
  } = data;

  const resolvedAddressLine1 = getAddressLine1(undefined, address_line1);
  const supportedAddressFields = pickSupportedModelFields("crm_Leads", {
    address: resolvedAddressLine1 || undefined,
    address_line1: resolvedAddressLine1 || undefined,
    address_line2: address_line2 || undefined,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
    postal_code: postal_code || undefined,
  });

  try {
    const lead = await prismadb.crm_Leads.create({
      data: {
        v: 1,
        createdBy: userId,
        updatedBy: userId,
        firstName: first_name || "",
        lastName: last_name,
        company,
        jobTitle,
        email,
        phone,
        ...supportedAddressFields,
        description,
        lead_source_id: lead_source_id || undefined,
        lead_status_id: lead_status_id || undefined,
        lead_type_id: lead_type_id || undefined,
        refered_by: refered_by || undefined,
        campaign: campaign || undefined,
        assigned_to: assigned_to || userId,
        accountsIDs: accountIDs || undefined,
      },
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
        address_line1,
        address_line2,
        city,
        state,
        country,
        postal_code,
        description,
        lead_source_id,
        lead_status_id,
        lead_type_id,
        refered_by,
        campaign,
        assigned_to,
        accountIDs,
      }
    });
    return { error: "Failed to create lead: " + (error.message || "Unknown error") };
  }
};
