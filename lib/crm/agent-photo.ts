import { isAgentPhotoInstruction } from "@/lib/crm/agent-photo-storage";

export { isAgentPhotoInstruction } from "@/lib/crm/agent-photo-storage";

/**
 * Safely extracts the photo URL (if any) from a contact/agent data object.
 * Checks all possible locations:
 * 1. direct fields: agent_photo, agentPhoto, photo, avatar, image, profileImage, profile_photo
 * 2. custom_fields_data: agent_photo, Agent Photo, photo, avatar, image, profile_photo, profilePhoto, or file objects
 * 3. imported_columns_data: entries with column/label matching agent photo
 * Filters out placeholder/instruction strings like "Add agent photo here", "n/a", etc.
 */
export function extractAgentPhotoUrl(data: any): string | null {
  if (!data || typeof data !== "object") return null;

  const candidates: unknown[] = [
    data.agent_photo,
    data.agentPhoto,
    data.photo,
    data.avatar,
    data.image,
    data.profileImage,
    data.profile_photo,
    data.profilePhoto,
  ];

  if (
    data.custom_fields_data &&
    typeof data.custom_fields_data === "object" &&
    !Array.isArray(data.custom_fields_data)
  ) {
    const cfd = data.custom_fields_data;
    candidates.push(
      cfd.agent_photo,
      cfd["Agent Photo"],
      cfd["agent_photo"],
      cfd["Agent photo"],
      cfd["agentPhoto"],
      cfd.photo,
      cfd.Photo,
      cfd.avatar,
      cfd.Avatar,
      cfd.image,
      cfd.Image,
      cfd.profile_photo,
      cfd["Profile Photo"],
      cfd.profilePhoto,
    );

    // Also check any file objects or URLs inside custom_fields_data
    for (const [key, val] of Object.entries(cfd)) {
      if (!val) continue;
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("photo") ||
        lowerKey.includes("avatar") ||
        lowerKey.includes("image") ||
        lowerKey.includes("picture")
      ) {
        candidates.push(val);
      } else if (typeof val === "object" && val !== null) {
        const fileObj = val as Record<string, unknown>;
        if (
          typeof fileObj.url === "string" &&
          (typeof fileObj.type !== "string" ||
            fileObj.type.startsWith("image/") ||
            String(fileObj.name ?? "").match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i))
        ) {
          candidates.push(val);
        }
      }
    }
  }

  if (Array.isArray(data.imported_columns_data)) {
    for (const item of data.imported_columns_data) {
      if (!item) continue;
      const col = (item.column || "").toLowerCase();
      const lbl = (item.label || "").toLowerCase();
      if (
        col.includes("photo") ||
        col.includes("avatar") ||
        col.includes("image") ||
        lbl.includes("photo") ||
        lbl.includes("avatar") ||
        lbl.includes("image")
      ) {
        candidates.push(item.value);
      }
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;

    // If candidate is a string
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed && !isAgentPhotoInstruction(trimmed)) {
        return trimmed;
      }
    }

    // If candidate is a file object { url: "..." }
    if (typeof candidate === "object" && candidate !== null) {
      const url = (candidate as any).url || (candidate as any).src;
      if (typeof url === "string") {
        const trimmed = url.trim();
        if (trimmed && !isAgentPhotoInstruction(trimmed)) {
          return trimmed;
        }
      }
    }
  }

  return null;
}

/**
 * Returns initials from first_name and last_name, or fallback to email or "?".
 * E.g., "Sophia" "Anderson" -> "SA"
 */
export function getAgentInitials(data: any): string {
  if (!data) return "?";
  const first = (data.first_name || "").trim().charAt(0).toUpperCase();
  const last = (data.last_name || "").trim().charAt(0).toUpperCase();
  if (first && last) return `${first}${last}`;
  if (first) return first;
  if (last) return last;
  if (data.name && typeof data.name === "string") {
    const parts = data.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0).toUpperCase()}${parts[parts.length - 1].charAt(0).toUpperCase()}`;
    }
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
  }
  if (data.email && typeof data.email === "string") {
    const emailChar = data.email.trim().charAt(0).toUpperCase();
    if (emailChar) return emailChar;
  }
  return "?";
}
