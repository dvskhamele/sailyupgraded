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

  if (!normalizedRole || normalizedRole === "all") {
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
        notIn: ["Customer", "Client", "Agent"],
      },
    };
  }

  return {};
}

export function matchesContactRoleFilter(
  filterRole?: string | null,
  contactRole?: string | null
): boolean {
  const normalizedFilter = filterRole?.trim().toLowerCase();
  const normalizedContactRole = contactRole?.trim().toLowerCase();

  if (!normalizedFilter || normalizedFilter === "all") {
    return true;
  }

  if (
    normalizedFilter === "customer" ||
    normalizedFilter === "customers" ||
    normalizedFilter === "client"
  ) {
    return normalizedContactRole === "customer" || normalizedContactRole === "client";
  }

  if (normalizedFilter === "agent" || normalizedFilter === "agents") {
    return normalizedContactRole === "agent";
  }

  if (normalizedFilter === "vendor" || normalizedFilter === "vendors") {
    return normalizedContactRole === "vendor";
  }

  if (normalizedFilter === "partner" || normalizedFilter === "partners") {
    return normalizedContactRole === "partner";
  }

  if (normalizedFilter === "others" || normalizedFilter === "other") {
    return normalizedContactRole !== "customer" &&
      normalizedContactRole !== "client" &&
      normalizedContactRole !== "agent";
  }

  return true;
}
