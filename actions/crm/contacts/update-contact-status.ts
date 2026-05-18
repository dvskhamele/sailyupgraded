"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";

export async function updateContactStatus(contactId: string, status: boolean) {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  try {
    const existing = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select: { id: true, status: true },
    });

    if (!existing) return { error: "Contact not found" };

    const contact = await prismadb.crm_Contacts.update({
      where: { id: contactId },
      data: {
        status,
        updatedBy: session.user.id,
      },
      select: { id: true, status: true, updatedAt: true },
    });

    await writeAuditLog({
      entityType: "contact",
      entityId: contactId,
      action: "updated",
      changes: [{ field: "status", old: existing.status, new: status }],
      userId: session.user.id,
    });

    revalidatePath(`/[locale]/(routes)/crm/contacts/${contactId}`, "page");
    return { data: contact };
  } catch (error) {
    console.error("[UPDATE_CONTACT_STATUS]", error);
    return { error: "Failed to update contact status" };
  }
}
