"use server";
import { getSession } from "@/lib/auth-server";

import { prismadb } from "@/lib/prisma";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getMinioBucket, getMinioClient } from "@/lib/minio";

export async function deleteDocument(documentId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthenticated");
  if (!session.user.organizationId) throw new Error("Organization context is required");

  if (!documentId) throw new Error("Document ID is required");

  const document = await prismadb.documents.findFirst({
    where: { id: documentId, organizationId: session.user.organizationId },
  });

  if (!document) throw new Error("Document not found");

  await prismadb.documents.delete({
    where: { id: documentId, organizationId: session.user.organizationId },
  });

  if (document.key) {
    await getMinioClient().send(
      new DeleteObjectCommand({
        Bucket: getMinioBucket(),
        Key: document.key,
      })
    );
  }
}
