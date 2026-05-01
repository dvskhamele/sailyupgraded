import type { Prisma } from "@prisma/client";

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

export function buildContactRoleFilter(
  role?: string | null
): Prisma.crm_ContactsWhereInput {
  const normalizedRole = role?.trim().toLowerCase();

  if (!normalizedRole) {
    return {};
  }

  if (normalizedRole === "customer" || normalizedRole === "customers" || normalizedRole === "client") {
    return {
      role: {
        in: ["Customer", "Client"],
      },
    };
  }

  if (normalizedRole === "agent" || normalizedRole === "agents") {
    return {
      role: "Agent",
    };
  }

  if (normalizedRole === "vendor" || normalizedRole === "vendors") {
    return {
      role: "Vendor",
    };
  }

  if (normalizedRole === "partner" || normalizedRole === "partners") {
    return {
      role: "Partner",
    };
  }

  if (normalizedRole === "others" || normalizedRole === "other") {
    return {
      role: {
        notIn: ["Customer", "Client", "Agent", "Vendor", "Partner"],
      },
    };
  }

  return {};
}
