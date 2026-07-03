"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function bulkLinkToAccount(documentIds: string[], accountId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (!session.user.organizationId) {
    throw new Error("Organization context is required");
  }

  await prismadb.documentsToAccounts.createMany({
    data: documentIds.map((document_id) => ({
      organizationId: session.user.organizationId!,
      document_id,
      account_id: accountId,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/[locale]/(routes)/documents");
}
