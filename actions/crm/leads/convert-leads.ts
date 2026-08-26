"use server";

import { getSession } from "@/lib/auth-server";
import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { pickExistingDbModelFields } from "@/lib/prisma-model-fields";
import { normalizeContactRole } from "@/lib/contact-options";
import type { Prisma } from "@prisma/client";

export const convertLeadsToContacts = async (leadIds: string[]) => {
  console.log("[CONVERT_LEADS] Received leadIds:", JSON.stringify(leadIds));
  const session = await getSession();
  if (!session) {
    console.log("[CONVERT_LEADS] Unauthorized");
    return { success: false, error: "Unauthorized", contactsCreated: [], skippedLeads: [] };
  }
  console.log("[CONTACT CREATE DEBUG] Entry point", {
    path: "actions/crm/leads/convert-leads.ts:convertLeadsToContacts",
    database: getDatabaseUrlDiagnostics(),
  });
  console.log("[CONTACT CREATE DEBUG] Incoming payload", { leadIds });

  // Handle both string[] and nested [string[]] (Next.js server action arg wrapping)
  const flatIds = Array.isArray(leadIds) ? leadIds.flat() : [];
  const ids = Array.from(new Set(flatIds.filter((id): id is string => typeof id === "string" && !!id)));
  
  console.log("[CONVERT_LEADS] Normalized ids:", JSON.stringify(ids));
  if (ids.length === 0) {
    return { success: false, error: "At least one lead is required", contactsCreated: [], skippedLeads: [] };
  }

  try {
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
    });

    console.log("[CONVERT_LEADS] Found leads count:", leads.length);
    if (leads.length === 0) {
      console.log("[CONVERT_LEADS] No active leads found for ids:", JSON.stringify(ids));
      return { success: false, error: "No active leads found to convert", contactsCreated: [], skippedLeads: [] };
    }

    // Find or create "Converted" status
    let convertedStatus = await prismadb.crm_Lead_Statuses.findFirst({
      where: { name: "Converted" },
    });

    if (!convertedStatus) {
      try {
        convertedStatus = await prismadb.crm_Lead_Statuses.create({
          data: {
            v: 0,
            name: "Converted",
            order: 99,
          },
        });
      } catch {
        convertedStatus = await prismadb.crm_Lead_Statuses.findFirst({
          where: { name: "Converted" },
        });
      }
    }

    const contactsCreated: string[] = [];
    const skippedLeads: string[] = [];
    const conversionErrors: string[] = [];

    for (const lead of leads) {
      console.log("[CONVERT_LEADS] Processing lead:", lead.id, lead.email);
      
      try {
        const result = await prismadb.$transaction(async (tx) => {
          // Check for duplicates by email or phone
          const filterConditions: Prisma.crm_ContactsWhereInput[] = [
            lead.email?.trim() ? { email: lead.email.trim() } : null,
            lead.personal_email?.trim() ? { personal_email: lead.personal_email.trim() } : null,
            lead.phone?.trim() ? { phone: lead.phone.trim() } : null,
            lead.mobile_phone?.trim() ? { mobile_phone: lead.mobile_phone.trim() } : null,
          ].filter(Boolean) as Prisma.crm_ContactsWhereInput[];

          let existingContact: { id: string } | null = null;
          if (filterConditions.length > 0) {
            existingContact = await tx.crm_Contacts.findFirst({
              where: {
                OR: filterConditions,
                deletedAt: null,
              },
              select: { id: true },
            });
          }

          if (existingContact) {
            console.log("[CONVERT_LEADS] Lead already exists as contact:", lead.id, existingContact.id);
            // Still update lead status so it doesn't remain an un-converted lead
            await tx.crm_Leads.update({
              where: { id: lead.id },
              data: {
                lead_status_id: convertedStatus?.id,
                deletedAt: new Date(),
                deletedBy: session.user.id,
              },
            });
            return { skipped: true, contactId: existingContact.id };
          }

          // Map lead to contact
          const contactData = {
            v: 0,
            first_name: lead.firstName || "",
            last_name: lead.lastName || lead.firstName || "Unknown",
            company: lead.company,
            jobTitle: lead.jobTitle,
            email: lead.email,
            personal_email: lead.personal_email,
            phone: lead.phone,
            office_phone: lead.office_phone,
            mobile_phone: lead.mobile_phone,
            description: lead.description,
            lead_source_id: lead.lead_source_id,
            lead_status_id: lead.lead_status_id,
            lead_type_id: lead.lead_type_id,
            refered_by: lead.refered_by,
            campaign: lead.campaign,
            assigned_to: lead.assigned_to,
            accountsIDs: lead.accountsIDs,
            address: lead.address,
            address_line1: lead.address_line1,
            address_line2: lead.address_line2,
            city: lead.city,
            country: lead.country,
            postal_code: lead.postal_code,
            state: lead.state,
            website: lead.website,
            social_twitter: lead.social_twitter,
            social_facebook: lead.social_facebook,
            social_linkedin: lead.social_linkedin,
            social_skype: lead.social_skype,
            social_instagram: lead.social_instagram,
            social_youtube: lead.social_youtube,
            social_tiktok: lead.social_tiktok,
            contact_type_id: lead.contact_type_id,
            role: normalizeContactRole(lead.role || "Customer"),
            status: true,
            createdBy: session.user.id,
            created_by: session.user.id,
            updatedBy: session.user.id,
            last_activity_by: session.user.id,
          };

          const cleanedContactData = await pickExistingDbModelFields("crm_Contacts", contactData);
          
          const contact = await tx.crm_Contacts.create({
            data: cleanedContactData as any,
            select: { id: true },
          });
          console.log("[CONTACT CREATE DEBUG] Created contact ID", { id: contact.id });

          // Update lead status and soft delete
          await tx.crm_Leads.update({
            where: { id: lead.id },
            data: {
              lead_status_id: convertedStatus?.id,
              deletedAt: new Date(),
              deletedBy: session.user.id,
            },
          });

          return { success: true, contactId: contact.id };
        });

        if (result.skipped) {
          skippedLeads.push(lead.id);
        } else if (result.success) {
          console.log("[CONVERT_LEADS] Created contact:", result.contactId);
          
          try {
            await writeAuditLog({
              entityType: "contact",
              entityId: result.contactId,
              action: "created",
              changes: [{ field: "source", old: null, new: "converted_from_lead" }],
              userId: session.user.id,
            });
            await writeAuditLog({
              entityType: "lead",
              entityId: lead.id,
              action: "updated",
              changes: [{ field: "status", old: lead.lead_status_id, new: "Converted" }],
              userId: session.user.id,
            });
          } catch (auditErr) {
            console.error("[CONVERT_LEADS] Audit log error:", auditErr);
          }

          contactsCreated.push(result.contactId);
        }
      } catch (itemError: any) {
        const errorMsg = itemError?.message || String(itemError);
        console.error(`[CONVERT_LEADS] Error processing lead ${lead.id}:`, errorMsg);
        conversionErrors.push(`Lead ${lead.id}: ${errorMsg}`);
      }
    }

    const results = { contactsCreated, skippedLeads };
    console.log("[CONVERT_LEADS] Finished results:", JSON.stringify(results));

    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    revalidatePath("/[locale]/(routes)/crm/contacts", "page");

    if (contactsCreated.length === 0 && skippedLeads.length === 0 && conversionErrors.length > 0) {
      return {
        success: false,
        error: `Failed to convert leads: ${conversionErrors.join("; ")}`,
        contactsCreated: [],
        skippedLeads: [],
      };
    }

    return {
      success: true,
      count: results.contactsCreated.length,
      skipped: results.skippedLeads.length,
      contactsCreated: results.contactsCreated,
      skippedLeads: results.skippedLeads,
      errors: conversionErrors.length > 0 ? conversionErrors : undefined,
    };
  } catch (error: any) {
    console.error("[CONVERT_LEADS] Error:", error);
    return {
      success: false,
      error: `Failed to convert leads: ${error.message || "Unknown error"}`,
      contactsCreated: [],
      skippedLeads: [],
    };
  }
};
