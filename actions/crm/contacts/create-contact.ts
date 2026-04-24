"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { pickSupportedModelFields } from "@/lib/prisma-model-fields";

export const createContact = async (data: {
  assigned_to?: string;
  assigned_account?: string;
  birthday_day?: string;
  birthday_month?: string;
  birthday_year?: string;
  description?: string;
  email?: string;
  personal_email?: string;
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
  social_twitter?: string;
  social_facebook?: string;
  social_linkedin?: string;
  social_skype?: string;
  social_instagram?: string;
  social_youtube?: string;
  social_tiktok?: string;
  contact_type_id?: string;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;
  const {
    assigned_to,
    assigned_account,
    birthday_day,
    birthday_month,
    birthday_year,
    contact_type_id,
    address,
    address_line1,
    address_line2,
    city,
    state,
    country,
    postal_code,
    ...rest
  } = data;

  const resolvedAddressLine1 = getAddressLine1(address, address_line1);
  const supportedAddressFields = pickSupportedModelFields("crm_Contacts", {
    address: resolvedAddressLine1 || undefined,
    address_line1: resolvedAddressLine1 || undefined,
    address_line2: address_line2 || undefined,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
    postal_code: postal_code || undefined,
  });

  try {
    const contact = await prismadb.crm_Contacts.create({
      data: {
        v: 1,
        createdBy: userId,
        updatedBy: userId,
        accountsIDs: assigned_account || undefined,
        assigned_to: assigned_to || undefined,
        contact_type_id: contact_type_id || undefined,
        tags: [],
        notes: {},
        birthday:
          birthday_day && birthday_month && birthday_year
            ? birthday_day + "/" + birthday_month + "/" + birthday_year
            : null,
        ...supportedAddressFields,
        ...rest,
      } as any,
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
        ...rest
      }
    });
    return { error: "Failed to create contact: " + (error.message || "Unknown error") };
  }
};
