"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { pickSupportedModelFields } from "@/lib/prisma-model-fields";

export const updateLead = async (data: {
  id: string;
  firstName?: string | null;
  lastName: string;
  company?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  description?: string | null;
  lead_source_id?: string | null;
  lead_status_id?: string | null;
  lead_type_id?: string | null;
  refered_by?: string | null;
  campaign?: string | null;
  assigned_to?: string;
  accountIDs?: string;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    id,
    firstName,
    lastName,
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
    address: resolvedAddressLine1 || null,
    address_line1: resolvedAddressLine1 || null,
    address_line2: address_line2 || null,
    city: city || null,
    state: state || null,
    country: country || null,
    postal_code: postal_code || null,
  });

  if (!id) return { error: "id is required" };

  try {
    const before = await prismadb.crm_Leads.findUnique({ where: { id, deletedAt: null } });
    const lead = await prismadb.crm_Leads.update({
      where: { id },
      data: {
        v: 1,
        updatedBy: userId,
        firstName: firstName || undefined,
        lastName,
        company,
        jobTitle,
        email,
        phone,
        ...supportedAddressFields,
        description,
        lead_source_id: lead_source_id || undefined,
        lead_status_id: lead_status_id || undefined,
        lead_type_id: lead_type_id || undefined,
        refered_by,
        campaign,
        assigned_to: assigned_to || userId,
        accountsIDs: accountIDs,
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
              ? `New lead ${firstName} ${lastName} has been added to the system and assigned to you.`
              : `Nová příležitost ${firstName} ${lastName} byla přidána do systému a přidělena vám.`,
          text:
            notifyRecipient.userLanguage === "en"
              ? `New lead ${firstName} ${lastName} has been added to the system and assigned to you. You can click here for detail: ${process.env.NEXT_PUBLIC_APP_URL}/crm/leads/${lead.id}`
              : `Nová příležitost ${firstName} ${lastName} byla přidána do systému a přidělena vám. Detaily naleznete zde: ${process.env.NEXT_PUBLIC_APP_URL}/crm/leads/${lead.id}`,
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
