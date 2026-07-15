/**
 * Lead Source Resolver
 *
 * Resolves a `source_platform` value (e.g. "instagram", "facebook", "linkedin")
 * to the matching `crm_Lead_Sources` record ID by performing a case-insensitive
 * lookup on the `name` field.
 *
 * The `crm_Lead_Sources` table stores display names like "Instagram", "Facebook",
 * "LinkedIn", etc. The `source_platform` field stores the lower-case platform
 * identifier. This utility bridges the two so that `lead_source_id` is
 * automatically populated whenever a lead is created with a `source_platform`.
 */
import { prismadb } from "@/lib/prisma";

/**
 * Maps known source_platform values to their crm_Lead_Sources name
 * for a fast path that avoids a DB query for common platforms.
 *
 * Extend this mapping as new platforms are added.
 */
const PLATFORM_TO_SOURCE_NAME: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  website: "Web",
  manual: "Other",
  referral: "Referral",
  "cold call": "Cold Call",
  "email campaign": "Email Campaign",
  event: "Event",
};

function normalizePlatform(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves a source_platform string to a crm_Lead_Sources ID.
 *
 * The resolution strategy is:
 * 1. Check the static PLATFORM_TO_SOURCE_NAME mapping for a direct hit.
 * 2. If found, query the DB using the mapped name (case-insensitive).
 * 3. If no mapping exists, try a direct case-insensitive name query against the raw value.
 * 4. If nothing is found, log a warning and return null — never fail the request.
 *
 * @param sourcePlatform - The raw source_platform value (e.g. "instagram", "linkedin")
 * @returns The lead source record ID, or null if no match was found
 */
export async function resolveSourcePlatformToLeadSourceId(
  sourcePlatform: string | null | undefined,
): Promise<string | null> {
  const platform = normalizePlatform(sourcePlatform);
  if (!platform) return null;

  const platformLower = platform.toLowerCase();

  try {
    // --- Step 1: Try the static mapping first (fastest path) ---
    const mappedName = PLATFORM_TO_SOURCE_NAME[platformLower];
    if (mappedName) {
      const record = await prismadb.crm_Lead_Sources.findFirst({
        where: { name: { equals: mappedName } },
        select: { id: true },
      });
      if (record) return record.id;
    }

    // --- Step 2: Fallback to a generic case-insensitive name lookup ---
    // This handles any platform that isn't in the static map.
    const records = await prismadb.crm_Lead_Sources.findMany({
      select: { id: true, name: true },
    });

    const matched = records.find(
      (r) => r.name.trim().toLowerCase() === platformLower,
    );

    if (matched) return matched.id;

    // --- Step 3: Nothing matched — log a warning ---
    console.warn(
      `[LEAD_SOURCE_RESOLVER] No matching Lead Source found for source_platform="${platform}". ` +
        `Existing lead source names: ${records.map((r) => `"${r.name}"`).join(", ")}. ` +
        `lead_source_id will remain null.`,
    );

    return null;
  } catch (error) {
    // Never fail the request — log and return null
    console.error(
      `[LEAD_SOURCE_RESOLVER] Error resolving source_platform="${platform}":`,
      error,
    );
    return null;
  }
}