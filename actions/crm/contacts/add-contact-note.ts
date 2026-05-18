"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { normalizeContactNotes, type CrmNote } from "@/lib/crm/notes";
import { writeAuditLog } from "@/lib/audit-log";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";

function makeNote(text: string): CrmNote {
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    type: "note",
  };
}

export async function addContactNote(contactId: string, text: string) {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const trimmedText = text.trim();
  if (!trimmedText) return { error: "Note cannot be empty" };

  try {
    const contact = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select: { id: true, notes: true, created_on: true },
    });

    if (!contact) return { error: "Contact not found" };

    const note = makeNote(trimmedText);
    const notes = [
      ...normalizeContactNotes(contact.notes, contact.created_on ?? new Date()),
      note,
    ];

    await prismadb.crm_Contacts.update({
      where: { id: contactId },
      data: {
        notes,
        updatedBy: session.user.id,
      },
    });

    await writeAuditLog({
      entityType: "contact",
      entityId: contactId,
      action: "updated",
      changes: [{ field: "notes", old: null, new: trimmedText }],
      userId: session.user.id,
    });

    revalidatePath(`/[locale]/(routes)/crm/contacts/${contactId}`, "page");
    return { data: note };
  } catch (error) {
    console.error("[ADD_CONTACT_NOTE]", error);
    return { error: "Failed to save note" };
  }
}
