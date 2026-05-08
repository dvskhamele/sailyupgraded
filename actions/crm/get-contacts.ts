import { cache } from "react";
import { prismadb, resetPrisma } from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildContactRoleFilter } from "@/lib/contact-options";

function isTransientPrismaConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("pool timeout: failed to retrieve a connection from pool") ||
    message.includes("read ECONNRESET") ||
    message.includes("pool is ending")
  );
}

function shouldResetPrismaConnection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("pool is ending") || message.includes("read ECONNRESET");
}

export const getContacts = cache(async (role?: string) => {
  const loadContacts = async () => {
    const select = await getCrmContactListSelect();
    return prismadb.crm_Contacts.findMany({
      where: {
        deletedAt: null,
        ...buildContactRoleFilter(role),
      },
      select,
    });
  };

  try {
    return await loadContacts();
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) {
      throw error;
    }

    if (shouldResetPrismaConnection(error)) {
      await resetPrisma();
    }

    return loadContacts();
  }
});
