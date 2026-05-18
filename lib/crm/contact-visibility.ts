import type { Prisma } from "@prisma/client";

export const CONTACT_VISIBILITY_ALL_MEMBERS = "all_members";
export const CONTACT_VISIBILITY_ASSIGNED_MEMBER = "assigned_member";

const CONTACT_VISIBILITY_ALL_MEMBER_VALUES = [
  CONTACT_VISIBILITY_ALL_MEMBERS,
  "all member",
  "all members",
  "All Member",
  "All members",
  "All Members",
  "all_member",
  "all",
] as const;

const CONTACT_VISIBILITY_ASSIGNED_MEMBER_VALUES = [
  CONTACT_VISIBILITY_ASSIGNED_MEMBER,
  "assigned member",
  "Assigned member",
  "Assigned Member",
  "assigned_members",
  "assigned",
] as const;

export const CONTACT_VISIBILITY_OPTIONS = [
  { value: CONTACT_VISIBILITY_ALL_MEMBERS, label: "All members" },
  { value: CONTACT_VISIBILITY_ASSIGNED_MEMBER, label: "Assigned member" },
] as const;

export type ContactVisibility = (typeof CONTACT_VISIBILITY_OPTIONS)[number]["value"];

type ContactViewer = {
  id?: string | null;
  role?: string | null;
};

function normalizeVisibilityToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

export function normalizeContactVisibility(value: unknown): ContactVisibility {
  const normalized = normalizeVisibilityToken(value);

  return CONTACT_VISIBILITY_ASSIGNED_MEMBER_VALUES
    .map(normalizeVisibilityToken)
    .includes(normalized)
    ? CONTACT_VISIBILITY_ASSIGNED_MEMBER
    : CONTACT_VISIBILITY_ALL_MEMBERS;
}

export function buildContactVisibilityFilter(
  viewer?: ContactViewer | null,
  hasVisibilityField = true,
): Prisma.crm_ContactsWhereInput {
  if (viewer?.role === "admin") {
    return {};
  }

  if (!viewer?.id) {
    return { AND: [{ id: "__no_contact_visibility_viewer__" }] };
  }

  if (!hasVisibilityField) {
    return {};
  }

  const publicVisibilityValues = Array.from(
    new Set(CONTACT_VISIBILITY_ALL_MEMBER_VALUES),
  );
  const assignedMemberVisibilityValues = Array.from(
    new Set(CONTACT_VISIBILITY_ASSIGNED_MEMBER_VALUES),
  );

  const assignedMemberVisibilityFilter = {
    OR: [
      { visible_to_name: null },
      { visible_to_name: "" },
      { visible_to_name: { in: publicVisibilityValues } },
      {
        visible_to_name: { in: assignedMemberVisibilityValues },
        assigned_to: viewer.id,
      },
    ],
  } as unknown as Prisma.crm_ContactsWhereInput;

  return {
    AND: [assignedMemberVisibilityFilter],
  };
}
