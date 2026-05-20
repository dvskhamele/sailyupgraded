import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/storage-usage";

export const WORKSPACE_STORAGE_LIMIT_BYTES = DEFAULT_STORAGE_LIMIT_BYTES;
export const CUSTOM_FIELD_FILE_LIMIT_BYTES = 100 * 1024;

export const CUSTOM_FIELD_ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const CUSTOM_FIELD_ALLOWED_FILE_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "docx",
] as const;

export type CustomFieldFileMetadata = {
  url: string;
  name: string;
  size: number;
  type: string;
};

const allowedMimeTypes = new Set<string>(CUSTOM_FIELD_ALLOWED_FILE_TYPES);
const allowedExtensions = new Set<string>(CUSTOM_FIELD_ALLOWED_FILE_EXTENSIONS);

export function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedCustomFieldFileType(filename: string, mimeType: string) {
  const extension = getFileExtension(filename);
  return allowedMimeTypes.has(mimeType) && allowedExtensions.has(extension);
}

export function validateCustomFieldFile(file: {
  name: string;
  size: number;
  type: string;
}) {
  if (file.size > CUSTOM_FIELD_FILE_LIMIT_BYTES) {
    return "File size must be 100KB or less";
  }

  if (!isAllowedCustomFieldFileType(file.name, file.type)) {
    return "File type must be pdf, png, jpg, jpeg, or docx";
  }

  return null;
}

export function validateWorkspaceStorageAvailable(storageUsed: number, fileSize: number) {
  if (storageUsed + fileSize > WORKSPACE_STORAGE_LIMIT_BYTES) {
    return "Workspace storage limit exceeded";
  }

  return null;
}

export function isCustomFieldFileMetadata(value: unknown): value is CustomFieldFileMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.url === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    Number.isFinite(candidate.size) &&
    typeof candidate.type === "string"
  );
}
