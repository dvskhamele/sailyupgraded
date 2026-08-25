"use server";
import { getSession } from "@/lib/auth-server";
import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sendEmail from "@/lib/sendmail";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import { getAddressLine1 } from "@/lib/crm-address";
import { normalizeContactRole } from "@/lib/contact-options";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { getSalesStageCollections } from "@/lib/crm-sales-stages";
import { connectUserById, resolveExistingUserId } from "@/lib/crm/resolve-user";
import {
  type CustomFieldValue,
  fieldAppliesToEntity,
  sanitizeCustomFieldValues,
} from "@/lib/custom-fields";
import { resolveContactTypeId, resolveLeadSourceId } from "@/lib/crm/contact-form-options";
import { resolveSourcePlatformToLeadSourceId } from "@/lib/crm/lead-source-resolver";
import { formatBirthdayForLeadDb } from "@/lib/crm/birthday";
import { serializeDecimals } from "@/lib/serialize-decimals";

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

const OPPORTUNITY_DESCRIPTION_MAX_LENGTH = 191;

function truncateForOpportunityDescription(value: string) {
  return Array.from(value).slice(0, OPPORTUNITY_DESCRIPTION_MAX_LENGTH).join("");
}

function buildManualLeadOpportunityMetadata(data: {
  leadId: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return {
    manualLeadSource: {
      leadId: data.leadId,
      firstName: normalizeOptionalText(data.firstName) ?? null,
      lastName: normalizeOptionalText(data.lastName) ?? null,
      company: normalizeOptionalText(data.company) ?? null,
      email: normalizeOptionalText(data.email) ?? null,
      phone: normalizeOptionalText(data.phone) ?? null,
    },
  };
}

function buildManualLeadOpportunityDescription(data: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  description?: string | null;
}) {
  const description = [
    "Created from manual Lead",
    [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || null,
    normalizeOptionalText(data.company) ? `Company: ${data.company}` : null,
    normalizeOptionalText(data.description) ? `Lead description: ${data.description}` : null,
  ].filter(Boolean).join("\n");

  return truncateForOpportunityDescription(description);
}

async function findExistingContactForLead(data: {
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
}) {
  const email = normalizeOptionalText(data.email);
  if (email) {
    const contact = await prismadb.crm_Contacts.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, first_name: true, last_name: true },
    });
    if (contact) return contact;
  }

  const phone = normalizeOptionalText(data.phone);
  if (phone) {
    const contact = await prismadb.crm_Contacts.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true, first_name: true, last_name: true },
    });
    if (contact) return contact;
  }

  const mobilePhone = normalizeOptionalText(data.mobilePhone);
  if (mobilePhone) {
    const contact = await prismadb.crm_Contacts.findFirst({
      where: { mobile_phone: mobilePhone, deletedAt: null },
      select: { id: true, first_name: true, last_name: true },
    });
    if (contact) return contact;
  }

  return null;
}

async function getOrCreateContactForLead(data: {
  userId: string;
  assignedTo?: string | null;
  accountId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  officePhone?: string | null;
  mobilePhone?: string | null;
  website?: string | null;
  country?: string | null;
  description?: string | null;
}) {
  const existingContact = await findExistingContactForLead(data);
  if (existingContact) {
    return existingContact;
  }

  const resolvedAssignedTo = await resolveExistingUserId(data.assignedTo, data.userId);
  const contactPayload = await pickExistingDbModelFields("crm_Contacts", {
    v: 0,
    first_name: data.firstName || "",
    last_name:
      data.lastName ||
      data.firstName ||
      normalizeOptionalText(data.email)?.split("@")[0] ||
      normalizeOptionalText(data.phone) ||
      normalizeOptionalText(data.mobilePhone) ||
      "Manual Lead",
    company: normalizeOptionalText(data.company),
    email: normalizeOptionalText(data.email),
    personal_email: normalizeOptionalText(data.personalEmail),
    phone: normalizeOptionalText(data.phone),
    mobile_phone: normalizeOptionalText(data.mobilePhone),
    office_phone: normalizeOptionalText(data.officePhone),
    website: normalizeOptionalText(data.website),
    country: normalizeOptionalText(data.country),
    description: normalizeOptionalText(data.description),
    assigned_to: resolvedAssignedTo || undefined,
    accountsIDs: normalizeOptionalText(data.accountId),
    status: true,
    role: normalizeContactRole("Customer"),
    createdBy: data.userId,
    created_by: data.userId,
    updatedBy: data.userId,
    last_activity_by: data.userId,
  });

  const contact = await prismadb.crm_Contacts.create({
    data: contactPayload as any,
    select: { id: true, first_name: true, last_name: true },
  });

  await writeAuditLog({
    entityType: "contact",
    entityId: contact.id,
    action: "created",
    changes: [{ field: "source", old: null, new: "manual_lead" }],
    userId: data.userId,
  });

  return contact;
}

async function linkContactToOpportunity(data: {
  contactId: string;
  opportunityId: string;
  userId: string;
}) {
  await prismadb.contactsToOpportunities.upsert({
    where: {
      contact_id_opportunity_id: {
        contact_id: data.contactId,
        opportunity_id: data.opportunityId,
      },
    },
    update: {},
    create: {
      contact_id: data.contactId,
      opportunity_id: data.opportunityId,
    },
  });

  await prismadb.crm_Opportunities.update({
    where: { id: data.opportunityId },
    data: {
      contact: data.contactId,
      updatedBy: data.userId,
      last_activity_by: data.userId,
    },
    select: { id: true },
  });
}

async function createPipelineOpportunityForLead(data: {
  leadId: string;
  userId: string;
  assignedTo?: string | null;
  accountId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  officePhone?: string | null;
  mobilePhone?: string | null;
  website?: string | null;
  country?: string | null;
  description?: string | null;
}) {
  const contact = await getOrCreateContactForLead(data);
  const leadMarker = `Linked Lead ID: ${data.leadId}`;
  const existingOpportunity = await prismadb.crm_Opportunities.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { custom_fields_data: { path: "$.manualLeadSource.leadId", equals: data.leadId } },
        { description: { contains: leadMarker } },
      ],
    },
    select: { id: true },
  });

  if (existingOpportunity) {
    await linkContactToOpportunity({
      contactId: contact.id,
      opportunityId: existingOpportunity.id,
      userId: data.userId,
    });
    return existingOpportunity;
  }

  const { firstStage } = await getSalesStageCollections();
  const resolvedAssignedTo = await resolveExistingUserId(data.assignedTo, data.userId);
  const resolvedCreatedBy = await resolveExistingUserId(data.userId);
  const accountId = normalizeOptionalText(data.accountId);
  const assignedAccount = accountId
    ? await prismadb.crm_Accounts.findFirst({
        where: { id: accountId, deletedAt: null },
        select: { id: true },
      })
    : null;
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
  const opportunityName =
    fullName ||
    normalizeOptionalText(data.company) ||
    normalizeOptionalText(data.email) ||
    normalizeOptionalText(data.phone) ||
    "Manual Lead";

  const opportunity = await prismadb.crm_Opportunities.create({
    data: {
      assigned_account: assignedAccount
        ? { connect: { id: assignedAccount.id } }
        : undefined,
      assigned_to_user: connectUserById(resolvedAssignedTo),
      assigned_sales_stage: firstStage
        ? { connect: { id: firstStage.id } }
        : undefined,
      clientName: fullName || null,
      contact: contact.id,
      contacts: {
        create: {
          contact: { connect: { id: contact.id } },
        },
      },
      created_by_user: connectUserById(resolvedCreatedBy),
      createdBy: data.userId,
      updatedBy: data.userId,
      last_activity_by: data.userId,
      custom_fields_data: buildManualLeadOpportunityMetadata(data),
      description: buildManualLeadOpportunityDescription(data),
      name: opportunityName,
      next_step: "New manual lead",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await writeAuditLog({
    entityType: "opportunity",
    entityId: opportunity.id,
    action: "created",
    changes: [{ field: "source", old: null, new: "manual_lead" }],
    userId: data.userId,
  });
  void inngest
    .send({ name: "crm/opportunity.saved", data: { record_id: opportunity.id } })
    .catch((error) => {
      console.error("[CREATE_LEAD_OPPORTUNITY_INGGEST]", error);
    });

  return opportunity;
}

export const createLead = async (data: {
  serial?: string;
  birthday?: string | Date | null;
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
  source_platform?: string;
  productId?: string;
  custom_fields_data?: Record<string, CustomFieldValue | null | undefined>;
}) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  console.log("[LEAD CREATE DEBUG] Entry point", {
    path: "actions/crm/leads/create-lead.ts:createLead",
    database: getDatabaseUrlDiagnostics(),
  });
  console.log("[LEAD CREATE DEBUG] Incoming lead payload", data);

  const userId = session.user.id;
  const {
    serial,
    birthday,
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
    source_platform,
    productId,
    custom_fields_data,
  } = data;

  const resolvedAddressLine1 = getAddressLine1(undefined, address_line1);
  const birthdayValue = formatBirthdayForLeadDb(
    birthday ??
      (birthday_day && birthday_month && birthday_year
        ? { birthday_day, birthday_month, birthday_year }
        : null),
  );
  const resolvedContactTypeId = await resolveContactTypeId(contact_type_id);
  const resolvedLeadSourceId =
    (await resolveLeadSourceId(lead_source_id)) ??
    (await resolveSourcePlatformToLeadSourceId(source_platform)) ??
    undefined;
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
    contact_type_id: resolvedContactTypeId,
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
  console.log("[LEAD CREATE DEBUG] Prisma create payload", supportedFields);
  try {
    console.log("[LEAD CREATE DEBUG] Executing prismadb.crm_Leads.create()");
    const lead = await prismadb.crm_Leads.create({
      data: supportedFields as any,
    });
    console.log("[LEAD CREATE DEBUG] Create result", lead);
    console.log("[LEAD CREATE DEBUG] Created lead ID", { id: lead.id });

    const verificationLead = await prismadb.crm_Leads.findUnique({
      where: { id: lead.id },
    });
    console.log("[LEAD CREATE DEBUG] Verification query result", verificationLead);

    if (!verificationLead) {
      console.error("[LEAD CREATE DEBUG] Verification query did not find created lead", {
        id: lead.id,
        database: getDatabaseUrlDiagnostics(),
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
    let pipelineOpportunity: { id: string } | null = null;
    try {
      pipelineOpportunity = await createPipelineOpportunityForLead({
        leadId: lead.id,
        userId,
        assignedTo: lead.assigned_to || assigned_to || userId,
        accountId: lead.accountsIDs || assigned_account || accountIDs,
        firstName: lead.firstName || first_name,
        lastName: lead.lastName || last_name,
        company: lead.company || company,
        email: lead.email || email,
        personalEmail: lead.personal_email || personal_email,
        phone: lead.phone || phone,
        officePhone: lead.office_phone || office_phone,
        mobilePhone: lead.mobile_phone || mobile_phone,
        website: lead.website || website,
        country: lead.country || country,
        description: lead.description || description,
      });
    } catch (pipelineErr) {
      console.error("[LEAD_CREATE_OPPORTUNITY_ERROR]", pipelineErr);
    }

    try {
      void inngest.send({ name: "crm/lead.saved", data: { record_id: lead.id } });
    } catch (inngestErr) {
      console.error("[LEAD_CREATE_INGGEST_ERROR]", inngestErr);
    }

    revalidatePath("/[locale]/crm/leads", "page");
    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    revalidatePath("/[locale]/crm/opportunities", "page");
    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");
    revalidatePath("/[locale]/crm/dashboard", "page");
    revalidatePath("/[locale]/(routes)/crm/dashboard", "page");
    console.log("[LEAD CREATE DEBUG] Completed without transaction rollback", {
      id: lead.id,
      pipelineOpportunityId: pipelineOpportunity?.id,
      note: "createLead does not wrap crm_Leads.create() in a transaction",
    });
    return { success: true, data: serializeDecimals(lead) };
  } catch (error: any) {
    console.error("[LEAD_CREATE_ERROR] Error detail:", {
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
    return { success: false, error: "Failed to create lead: " + (error.message || "Unknown error") };
  }
};
