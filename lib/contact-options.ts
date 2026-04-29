export const CONTACT_ROLE_OPTIONS = [
  "Agent",
  "Customer",
  "Partner",
  "Vendor",
] as const;

export type ContactRole = (typeof CONTACT_ROLE_OPTIONS)[number];

export const CONTACT_STATUS_OPTIONS = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
] as const;

export function normalizeContactRole(role?: string | null): ContactRole {
  if (role && CONTACT_ROLE_OPTIONS.includes(role as ContactRole)) {
    return role as ContactRole;
  }

  return "Customer";
}
