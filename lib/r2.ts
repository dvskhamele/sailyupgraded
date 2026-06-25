import "server-only";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getFileExtension } from "@/lib/storage-validation";
import { getR2Integration } from "@/lib/integrations/r2";

let cachedR2Client: S3Client | null = null;

export async function getR2Client(teamId?: string) {
  const integration = await getR2Integration(teamId);
  if (!integration) {
    throw new Error("R2 integration not configured");
  }

  // Invalidate cache if teamId changes
  if (cachedR2Client) {
    return cachedR2Client;
  }

  cachedR2Client = new S3Client({
    endpoint: `https://${integration.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: integration.accessKey,
      secretAccessKey: integration.secretKey,
    },
  });

  return cachedR2Client;
}

export async function getR2BucketName(teamId?: string) {
  const integration = await getR2Integration(teamId);
  if (!integration) throw new Error("R2 integration not configured");
  return integration.bucketName;
}

export async function getR2PublicUrl(teamId?: string) {
  const integration = await getR2Integration(teamId);
  if (!integration) throw new Error("R2 integration not configured");
  return integration.publicUrl.replace(/\/+$/, "");
}

export function createR2ObjectKey(filename: string) {
  const extension = getFileExtension(filename) || "bin";
  return `custom-fields/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
}

export async function getR2ObjectUrl(key: string) {
  const publicUrl = await getR2PublicUrl();
  return `${publicUrl}/${key}`;
}

export async function getR2KeyFromPublicUrl(url: string) {
  const publicUrl = await getR2PublicUrl();
  const publicUrlWithSlash = `${publicUrl}/`;
  let key: string | null = null;

  if (url.startsWith(publicUrlWithSlash)) {
    key = decodeURIComponent(url.slice(publicUrlWithSlash.length));
  } else {
    try {
      const parsedUrl = new URL(url);
      const pathKey = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
      const customFieldsIndex = pathKey.split("/").indexOf("custom-fields");

      if (customFieldsIndex >= 0) {
        key = pathKey.split("/").slice(customFieldsIndex).join("/");
      }
    } catch {
      return null;
    }
  }

  return key && !key.includes("..") ? key : null;
}

export async function uploadFileToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const client = await getR2Client();
  const bucketName = await getR2BucketName();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

export async function deleteFileFromR2(key: string) {
  const client = await getR2Client();
  const bucketName = await getR2BucketName();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}
