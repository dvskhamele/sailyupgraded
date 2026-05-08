"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";

export const deleteContact = async (contactId: string) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  if (!contactId) return { error: "contactId is required" };

  try {
    await prismadb.crm_Contacts.update({
      where: { id: contactId },
      data: { deletedAt: new Date(), deletedBy: session.user.id },
    });
    await writeAuditLog({
      entityType: "contact",
      entityId: contactId,
      action: "deleted",
      changes: null,
      userId: session.user.id,
    });
    revalidatePath("/[locale]/(routes)/crm/contacts", "page");
    return { success: true };
  } catch (error) {
    console.log("[DELETE_CONTACT]", error);
    return { error: "Failed to delete contact" };
  }
};

export const bulkDeleteContacts = async (contactIds: string[]) => {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const ids = Array.from(new Set(contactIds.filter(Boolean)));
  if (ids.length === 0) return { error: "At least one contact is required" };

  try {
    const contacts = await prismadb.crm_Contacts.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });

    if (contacts.length === 0) return { error: "No contacts found" };

    const deletedAt = new Date();
    await prismadb.crm_Contacts.updateMany({
      where: { id: { in: contacts.map((contact) => contact.id) } },
      data: { deletedAt, deletedBy: session.user.id },
    });

    await Promise.all(
      contacts.map((contact) =>
        writeAuditLog({
          entityType: "contact",
          entityId: contact.id,
          action: "deleted",
          changes: null,
          userId: session.user.id,
        })
      )
    );

    revalidatePath("/[locale]/(routes)/crm/contacts", "page");
    return { success: true, count: contacts.length };
  } catch (error) {
    console.log("[BULK_DELETE_CONTACTS]", error);
    return { error: "Failed to delete contacts" };
  }
};
