import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { getFileExtension } from "@/lib/storage-validation";

let cachedR2Client: S3Client | null = null;

function requireR2Env(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getR2Client() {
  if (cachedR2Client) {
    return cachedR2Client;
  }

  cachedR2Client = new S3Client({
    endpoint: `https://${requireR2Env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: requireR2Env("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireR2Env("R2_SECRET_ACCESS_KEY"),
    },
  });

  return cachedR2Client;
}

export function getR2BucketName() {
  return requireR2Env("R2_BUCKET_NAME");
}

export function getR2PublicUrl() {
  return requireR2Env("R2_PUBLIC_URL").replace(/\/+$/, "");
}

export function createR2ObjectKey(filename: string) {
  const extension = getFileExtension(filename) || "bin";
  return `custom-fields/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
}

export function getR2ObjectUrl(key: string) {
  return `${getR2PublicUrl()}/${key}`;
}

export function getR2KeyFromPublicUrl(url: string) {
  const publicUrl = `${getR2PublicUrl()}/`;
  let key: string | null = null;

  if (url.startsWith(publicUrl)) {
    key = decodeURIComponent(url.slice(publicUrl.length));
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
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

export async function deleteFileFromR2(key: string) {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    }),
  );
}
