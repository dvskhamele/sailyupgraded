export type MergeTagTarget = {
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  position?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  name?: string | null;
  fullName?: string | null;
};

const MERGE_TAG_MAP: Record<string, (target: MergeTagTarget) => string | undefined | null> = {
  first_name: (t) => t.first_name ?? t.firstName,
  firstName: (t) => t.firstName ?? t.first_name,
  last_name: (t) => t.last_name ?? t.lastName,
  lastName: (t) => t.lastName ?? t.last_name,
  email: (t) => t.email,
  company: (t) => t.company,
  position: (t) => t.position ?? t.jobTitle,
  jobTitle: (t) => t.jobTitle ?? t.position,
  phone: (t) => t.phone,
  name: (t) => t.name ?? t.fullName,
  fullName: (t) => t.fullName ?? t.name,
};

export function resolveMergeTags(text: string, target: MergeTagTarget): string {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, tag: string) => {
    const resolver = MERGE_TAG_MAP[tag];
    if (!resolver) return match; // unknown tag — leave as-is
    return resolver(target) ?? "";
  });
}
