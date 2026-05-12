import type { Prisma } from "@prisma/client";

export const CONTACT_ROLE_OPTIONS = [
  "Agent",
  "Customer",
  "Client",
  "Partner",
  "Vendor",
  "Other",
] as const;

export type ContactRole = (typeof CONTACT_ROLE_OPTIONS)[number];

type ContactRoleView = {
  filter: string;
  heading: string;
  pageTitle: string;
  createTitle: string;
  defaultCreateRole?: ContactRole;
};

const CONTACT_ROLE_IMPORT_ALIASES: Record<ContactRole, string[]> = {
  Agent: ["agent", "agent id", "agent number", "agent no", "agent code"],
  Customer: ["customer", "customer id", "customer number"],
  Client: ["client", "client id", "client number"],
  Partner: ["partner", "partner id", "partner number", "partner code"],
  Vendor: ["vendor", "vendor id", "vendor number", "supplier", "supplier id", "supplier number"],
  Other: ["other", "others", "other id", "other number"],
};

const CONTACT_ROLE_DB_VALUES: Record<ContactRole, string[]> = {
  Agent: ["Agent", "agent", "Agents", "agents"],
  Customer: ["Customer", "customer", "Customers", "customers"],
  Client: ["Client", "client", "Clients", "clients"],
  Partner: ["Partner", "partner", "Partners", "partners"],
  Vendor: ["Vendor", "vendor", "Vendors", "vendors"],
  Other: ["Other", "other", "Others", "others"],
};

export const CONTACT_STATUS_OPTIONS = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
] as const;

export function normalizeContactRole(role?: string | null): ContactRole {
  return detectContactRole(role) ?? "Customer";
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
        in: [...CONTACT_ROLE_DB_VALUES.Customer, ...CONTACT_ROLE_DB_VALUES.Client],
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
      role: {
        in: CONTACT_ROLE_DB_VALUES.Vendor,
      },
    };
  }

  if (normalizedRole === "partner" || normalizedRole === "partners") {
    return {
      role: {
        in: CONTACT_ROLE_DB_VALUES.Partner,
      },
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

export function getContactRoleView(filterRole?: string | null): ContactRoleView {
  const normalizedRole = filterRole?.trim().toLowerCase();

  if (!normalizedRole || normalizedRole === "all") {
    return {
      filter: "all",
      heading: "Contacts",
      pageTitle: "Contacts",
      createTitle: "Create new Contact",
    };
  }

  if (normalizedRole === "customer" || normalizedRole === "customers" || normalizedRole === "client") {
    return {
      filter: "customer",
      heading: "Customers / Clients",
      pageTitle: "Customers / Clients",
      createTitle: "Create new Customer",
      defaultCreateRole: "Customer",
    };
  }

  if (normalizedRole === "agent" || normalizedRole === "agents") {
    return {
      filter: "agent",
      heading: "Agents",
      pageTitle: "Agents",
      createTitle: "Create new Agent",
      defaultCreateRole: "Agent",
    };
  }

  if (normalizedRole === "partner" || normalizedRole === "partners") {
    return {
      filter: "partner",
      heading: "Partners",
      pageTitle: "Partners",
      createTitle: "Create new Partner",
      defaultCreateRole: "Partner",
    };
  }

  if (normalizedRole === "vendor" || normalizedRole === "vendors") {
    return {
      filter: "vendor",
      heading: "Vendors",
      pageTitle: "Vendors",
      createTitle: "Create new Vendor",
      defaultCreateRole: "Vendor",
    };
  }

  if (normalizedRole === "others" || normalizedRole === "other") {
    return {
      filter: "others",
      heading: "Others",
      pageTitle: "Others",
      createTitle: "Create new Contact",
    };
  }

  return {
    filter: normalizedRole,
    heading: "Contacts",
    pageTitle: "Contacts",
    createTitle: "Create new Contact",
  };
}

export function getContactIdentifierLabel(role?: string | null): string {
  const normalizedRole = normalizeContactRole(role);

  switch (normalizedRole) {
    case "Agent":
      return "Agent Number";
    case "Client":
      return "Client ID";
    case "Partner":
      return "Partner ID";
    case "Vendor":
      return "Vendor ID";
    case "Other":
      return "Other ID";
    case "Customer":
    default:
      return "Customer ID";
  }
}

export function detectContactRole(role?: string | null): ContactRole | undefined {
  const normalizedRole = role?.trim().toLowerCase();

  if (!normalizedRole) {
    return undefined;
  }

  if (normalizedRole === "customer" || normalizedRole === "customers") {
    return "Customer";
  }

  if (normalizedRole === "client" || normalizedRole === "clients") {
    return "Client";
  }

  if (normalizedRole === "agent" || normalizedRole === "agents") {
    return "Agent";
  }

  if (normalizedRole === "vendor" || normalizedRole === "vendors") {
    return "Vendor";
  }

  if (normalizedRole === "partner" || normalizedRole === "partners") {
    return "Partner";
  }

  if (normalizedRole === "other" || normalizedRole === "others") {
    return "Other";
  }

  return CONTACT_ROLE_OPTIONS.includes(role as ContactRole) ? (role as ContactRole) : undefined;
}

export function inferContactRoleFromIdentifierContext(...values: Array<string | null | undefined>): ContactRole | undefined {
  const normalizedValues = values
    .map((value) => value?.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((value): value is string => Boolean(value));

  if (normalizedValues.length === 0) {
    return undefined;
  }

  for (const role of CONTACT_ROLE_OPTIONS) {
    const aliases = CONTACT_ROLE_IMPORT_ALIASES[role].map((alias) =>
      alias.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    const match = normalizedValues.some((value) =>
      aliases.some((alias) => value === alias || value.includes(alias))
    );

    if (match) {
      return role;
    }
  }

  return undefined;
}

type ReferenceIdContact = {
  role?: string | null;
  serial?: string | number | null;
  agentNumber?: string | number | null;
  agentId?: string | number | null;
  customerNumber?: string | number | null;
  customerId?: string | number | null;
  clientNumber?: string | number | null;
  clientId?: string | number | null;
  otherNumber?: string | number | null;
  otherId?: string | number | null;
};

function formatReferenceIdValue(value: string | number | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

export function getReferenceId(contact: ReferenceIdContact | null | undefined): string {
  if (!contact) {
    return "-";
  }

  const role = contact.role?.trim().toLowerCase();
  const fallback = formatReferenceIdValue(contact.serial);

  switch (role) {
    case "agent":
    case "agents":
      return (
        formatReferenceIdValue(contact.agentNumber) ||
        formatReferenceIdValue(contact.agentId) ||
        fallback ||
        "-"
      );

    case "customer":
    case "customers":
      return (
        formatReferenceIdValue(contact.customerNumber) ||
        formatReferenceIdValue(contact.customerId) ||
        fallback ||
        "-"
      );

    case "client":
    case "clients":
      return (
        formatReferenceIdValue(contact.clientNumber) ||
        formatReferenceIdValue(contact.clientId) ||
        fallback ||
        "-"
      );

    default:
      return (
        formatReferenceIdValue(contact.otherNumber) ||
        formatReferenceIdValue(contact.otherId) ||
        fallback ||
        "-"
      );
  }
}
