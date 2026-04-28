import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getMinioBucket, getMinioClient } from "@/lib/minio";

function invoiceKey(invoiceId: string) {
  return `invoices/${invoiceId}.pdf`;
}

export async function uploadInvoicePdf(invoiceId: string, pdf: Buffer): Promise<string> {
  const key = invoiceKey(invoiceId);
  await getMinioClient().send(
    new PutObjectCommand({
      Bucket: getMinioBucket(),
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );
  return key;
}

export async function getInvoicePdfStream(key: string) {
  const res = await getMinioClient().send(
    new GetObjectCommand({ Bucket: getMinioBucket(), Key: key }),
  );
  return res.Body;
}

export async function getInvoicePdfPresignedUrl(
  key: string,
  expirySeconds = 300,
): Promise<string> {
  return getSignedUrl(
    getMinioClient(),
    new GetObjectCommand({ Bucket: getMinioBucket(), Key: key }),
    { expiresIn: expirySeconds },
  );
}

export async function uploadInvoiceAttachment(
  invoiceId: string,
  attachmentId: string,
  buf: Buffer,
  mime: string,
): Promise<string> {
  const key = `invoices/${invoiceId}/attachments/${attachmentId}`;
  await getMinioClient().send(
    new PutObjectCommand({
      Bucket: getMinioBucket(),
      Key: key,
      Body: buf,
      ContentType: mime,
    }),
  );
  return key;
}
