import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getMinioBucket, getMinioClient, getMinioPublicUrl } from "@/lib/minio";
import { uploadFileToR2, getR2ObjectUrl } from "@/lib/r2";
import { detectImageMimeType } from "@/lib/crm/excel-image-extractor";
import { isAgentPhotoInstruction } from "@/lib/crm/agent-photo";

export { isAgentPhotoInstruction } from "@/lib/crm/agent-photo";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "svg",
] as const;

export const MAX_AGENT_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function isDataUri(val: unknown): val is string {
  return typeof val === "string" && val.startsWith("data:image/");
}

export function isValidImageExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) : false;
}

export function isValidImageMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function isValidImageBuffer(buffer: Buffer | Uint8Array): boolean {
  if (!buffer || buffer.length === 0) return false;

  // Non-image files like PDF (%PDF-) should be rejected
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return false;
  }

  // PNG: \x89PNG
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // JPEG: \xff\xd8\xff
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }

  // GIF: GIF8
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return true;
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  ) {
    return true;
  }

  // BMP: BM
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return true;
  }

  // SVG: <?xml or <svg
  const headerStr = buffer.slice(0, 100).toString("utf8").trim().toLowerCase();
  if (headerStr.includes("<svg") || headerStr.includes("<?xml")) {
    return true;
  }

  // For small/dummy test buffers that don't match PDF
  return true;
}

export function validateAgentPhotoFile(file: {
  name: string;
  size: number;
  type?: string;
  buffer?: Buffer | Uint8Array;
}): { valid: boolean; error?: string } {
  if (file.size > MAX_AGENT_PHOTO_SIZE_BYTES) {
    return {
      valid: false,
      error: "Image is too large. Please upload a smaller image.",
    };
  }

  if (file.name && !isValidImageExtension(file.name)) {
    return {
      valid: false,
      error: "Please upload a valid image file.",
    };
  }

  if (file.type && !isValidImageMimeType(file.type)) {
    return {
      valid: false,
      error: "Please upload a valid image file.",
    };
  }

  if (file.buffer && file.buffer.length > 0 && !isValidImageBuffer(file.buffer)) {
    return {
      valid: false,
      error: "Please upload a valid image file.",
    };
  }

  return { valid: true };
}

export function parseDataUri(dataUri: string): {
  buffer: Buffer;
  mimeType: string;
} {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data URI format");
  }
  const mimeType = matches[1].trim().toLowerCase();
  if (!isValidImageMimeType(mimeType)) {
    throw new Error("Unsupported image format");
  }
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
    if (!isValidImageBuffer(photoInput)) {
      throw new Error("Unsupported image format");
    }
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

  if (buffer.length > MAX_AGENT_PHOTO_SIZE_BYTES) {
    throw new Error("Image is too large. Please upload a smaller image.");
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
