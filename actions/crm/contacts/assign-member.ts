"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { CONTACT_VISIBILITY_ASSIGNED_MEMBER } from "@/lib/crm/contact-visibility";

export const bulkAssignContacts = async (
  contactIds: string[],
  assignedMemberId: string
) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(contactIds.filter(Boolean)));
  if (ids.length === 0)
    return { error: "At least one contact is required" };
  if (!assignedMemberId) return { error: "Assigned member is required" };

  try {
    // First verify the member exists and is active
    const member = await prismadb.users.findFirst({
      where: { id: assignedMemberId, userStatus: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!member) return { error: "Assigned member not found or inactive" };

    // Fetch contacts that are visible to the user
    const contacts = await prismadb.crm_Contacts.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select: { id: true },
    });

    if (contacts.length === 0) return { error: "No contacts found" };

    // Update all contacts in one go
    await prismadb.crm_Contacts.updateMany({
      where: { id: { in: contacts.map((contact) => contact.id) } },
      data: { 
        assigned_to: assignedMemberId,
        visible_to_name: CONTACT_VISIBILITY_ASSIGNED_MEMBER
      },
    });

    await Promise.all(
      contacts.map((contact) =>
        writeAuditLog({
          entityType: "contact",
          entityId: contact.id,
          action: "updated",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/crm/contacts", "page");
    return { success: true, count: contacts.length };
  } catch (error) {
    console.log("[BULK_ASSIGN_CONTACTS]", error);
    return { error: "Failed to assign contacts" };
  }
};
