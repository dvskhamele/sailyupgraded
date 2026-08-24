import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getMinioBucket, getMinioClient, getMinioPublicUrl } from "@/lib/minio";
import { uploadFileToR2, getR2ObjectUrl } from "@/lib/r2";
import { detectImageMimeType } from "@/lib/crm/excel-image-extractor";

export function isAgentPhotoInstruction(val: unknown): boolean {
  if (val == null) return true;
  if (typeof val !== "string") return false;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed === "" ||
    trimmed === "add agent photo here" ||
    trimmed === "add photo here" ||
    trimmed === "agent photo here" ||
    trimmed === "upload photo here" ||
    trimmed === "photo here" ||
    trimmed === "n/a" ||
    trimmed === "none" ||
    trimmed === "null" ||
    trimmed === "undefined"
  );
}

export function isDataUri(val: unknown): val is string {
  return typeof val === "string" && val.startsWith("data:image/");
}

export function parseDataUri(dataUri: string): {
  buffer: Buffer;
  mimeType: string;
} {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data URI format");
  }
  const mimeType = matches[1];
  const base64Data = matches[2].trim();
  // Validate base64 content
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    throw new Error("Invalid base64 encoding in image data URI");
  }
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    throw new Error("Empty image buffer decoded from data URI");
  }
  return { buffer, mimeType };
}

/**
 * Upload an agent photo (Buffer, Data URI, or URL) to CRM storage.
 * Reuses existing MinIO/S3 and R2 infrastructure.
 */
export async function uploadAgentPhoto(
  photoInput: string | Buffer | null | undefined,
  filename?: string
): Promise<string> {
  if (!photoInput) return "";

  if (typeof photoInput === "string") {
    const trimmed = photoInput.trim();
    if (isAgentPhotoInstruction(trimmed)) {
      return "";
    }

    // If already a hosted URL, return as is
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/uploads/") ||
      trimmed.startsWith("/avatars/")
    ) {
      return trimmed;
    }

    // If Data URI, parse buffer and mimeType
    if (isDataUri(trimmed)) {
      const { buffer, mimeType } = parseDataUri(trimmed);
      return uploadAgentPhotoBuffer(buffer, mimeType, filename);
    }
  }

  if (Buffer.isBuffer(photoInput)) {
    const mimeType = detectImageMimeType(photoInput, filename);
    return uploadAgentPhotoBuffer(photoInput, mimeType, filename);
  }

  return "";
}

export async function uploadAgentPhotoBuffer(
  buffer: Buffer,
  mimeType: string,
  filename?: string
): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty image buffer provided");
  }

  const ext =
    filename?.split(".").pop()?.toLowerCase() ||
    mimeType.split("/")[1] ||
    "png";
  const key = `avatars/agent_${randomUUID()}.${ext}`;

  // 1. Try MinIO / S3 storage
  try {
    const bucket = getMinioBucket();
    const client = getMinioClient();
    if (bucket && client) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      const publicUrl = getMinioPublicUrl();
      if (publicUrl) {
        return `${publicUrl.replace(/\/+$/, "")}/${bucket}/${key}`;
      }
    }
  } catch (err: any) {
    // If MinIO fails or is not configured, fall through to R2
  }

  // 2. Try Cloudflare R2 storage
  try {
    await uploadFileToR2({
      key,
      body: buffer,
      contentType: mimeType,
    });
    const r2Url = await getR2ObjectUrl(key);
    if (r2Url) return r2Url;
  } catch (err: any) {
    // If R2 is not configured, fall through to data URI
  }

  // 3. Fallback to Data URI if storage not configured (e.g. mock/test environments)
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
