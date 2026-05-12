import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";

export type NamedOption = { id: string; name: string };

const ROLE_PLACEHOLDER = `${String.fromCharCode(60)}ROLE${String.fromCharCode(62)}`;

const HIDDEN_CONTACT_TYPE_NAMES = [
  "Agent",
  "Customer",
  "Partner",
  "Vendor",
  `${ROLE_PLACEHOLDER} KNOWN FOR YEARS`,
  `HIGH_RISK ${ROLE_PLACEHOLDER}`,
  `UNKNOWN ${ROLE_PLACEHOLDER}`,
  "MARKETING DEPARTMENT KNOWN KNOWN FOR YEARS",
] as const;

const DEFAULT_CONTACT_TYPE_NAMES = [
  "POC 1 TO 5YRS",
  "POC BUSINESS REFERRAL",
  "POC NEW UNDER 1YR",
  "FINANCE DEPARTMENT KNOWN",
  "FINANCE DEPARTMENT NEW",
  "TECHNICAL DEPARTMENT KNOWN",
  "TECHNICAL DEPARTMENT NEW",
  "LEGAL DEPARTMENT KNOWN",
  "LEGAL DEPARTMENT UNKNOWN",
  "SUPPORTER CHAMPION ALLY",
  "SUPPORTER NEUTRAL",
  "UNTRUSTED HIGH RISK",
  "PRINCIPAL MAIN OWNER 5YRS PLUS",
  "PRINCIPAL ESTABLISHED 1 TO 5YRS",
  "PRINCIPAL NEW UNDER 1YR",
  "DECISION MAKER FROM TEAM",
  "MARKETING DEPARTMENT NEW",
  "MARKETING DEPARTMENT KNOWN",
  "KNOWN FOR YEARS",
  "HIGH_RISK",
  "UNKNOWN",
] as const;

const SOCIAL_LEAD_SOURCE_NAMES = [
  "Twitter / X",
  "Facebook",
  "LinkedIn",
  "Threads",
  "Instagram",
  "YouTube",
  "TikTok",
] as const;

function getVisibleContactTypes(contactTypes: NamedOption[]) {
  const hiddenNames = new Set(HIDDEN_CONTACT_TYPE_NAMES.map((name) => name.toLowerCase()));
  const defaultOrder = new Map(DEFAULT_CONTACT_TYPE_NAMES.map((name, index) => [name.toLowerCase(), index]));

  return contactTypes
    .filter((type) => !hiddenNames.has(type.name.trim().toLowerCase()))
    .sort((left, right) => {
      const leftOrder = defaultOrder.get(left.name.trim().toLowerCase());
      const rightOrder = defaultOrder.get(right.name.trim().toLowerCase());

      if (leftOrder != null && rightOrder != null) return leftOrder - rightOrder;
      if (leftOrder != null) return -1;
      if (rightOrder != null) return 1;
      return left.name.localeCompare(right.name);
    });
}

export function appendSocialLeadSourceOptions<T extends NamedOption>(leadSources: T[]): T[] {
  const seen = new Set(leadSources.map((source) => source.name.trim().toLowerCase()));
  const next = [...leadSources];

  for (const name of SOCIAL_LEAD_SOURCE_NAMES) {
    const normalized = name.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push({ id: name, name } as T);
  }

  return next;
}

export async function resolveLeadSourceId(value?: string | null): Promise<string | undefined> {
  if (!value?.trim()) return undefined;

  const existing = await prismadb.crm_Lead_Sources.findFirst({
    where: {
      OR: [{ id: value }, { name: value }],
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prismadb.crm_Lead_Sources.create({
    data: { name: value.trim() },
    select: { id: true },
  });

  return created.id;
}

export async function resolveContactTypeId(value?: string | null): Promise<string | undefined> {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  const existing = await prismadb.crm_Contact_Types.findFirst({
    where: {
      OR: [{ id: trimmedValue }, { name: trimmedValue }],
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prismadb.crm_Contact_Types.upsert({
    where: { name: trimmedValue },
    update: {},
    create: { name: trimmedValue },
    select: { id: true },
  });

  return created.id;
}

export async function ensureDefaultContactTypes(): Promise<NamedOption[]> {
  const existing = await prismadb.crm_Contact_Types.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const existingNames = new Set(existing.map((type) => type.name.trim().toLowerCase()));
  const missingNames = DEFAULT_CONTACT_TYPE_NAMES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (missingNames.length === 0) {
    return getVisibleContactTypes(existing);
  }

  await Promise.all(
    missingNames.map((name) =>
      prismadb.crm_Contact_Types.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const updated = await prismadb.crm_Contact_Types.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return getVisibleContactTypes(updated);
}

function getFallbackContactFormOptionsData() {
  return {
    accounts: [],
    contactTypes: DEFAULT_CONTACT_TYPE_NAMES.map((name) => ({ id: name, name })),
    leadSources: appendSocialLeadSourceOptions([]),
    leadStatuses: [],
    leadTypes: [],
    products: [],
  };
}

function shouldUseContactOptionsFallback(error: unknown) {
  return isPrismaAccessDeniedError(error) || isTransientPrismaConnectionError(error);
}

export async function getContactFormOptionsData() {
  try {
    return await withPrismaRetry(async () => {
      const accounts = await prismadb.crm_Accounts.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const contactTypes = await ensureDefaultContactTypes();
      const leadSources = await prismadb.crm_Lead_Sources.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const leadStatuses = await prismadb.crm_Lead_Statuses.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const leadTypes = await prismadb.crm_Lead_Types.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const products = await prismadb.crm_Products.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return {
        accounts,
        contactTypes,
        leadSources: appendSocialLeadSourceOptions(leadSources),
        leadStatuses,
        leadTypes,
        products,
      };
    });
  } catch (error) {
    if (!shouldUseContactOptionsFallback(error)) {
      throw error;
    }

    console.warn(
      "[Contact form options] database unavailable; using local fallback options.",
    );
    return getFallbackContactFormOptionsData();
  }
}
