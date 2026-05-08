import { prismadb } from "@/lib/prisma";

export type NamedOption = { id: string; name: string };

const SOCIAL_LEAD_SOURCE_NAMES = [
  "Twitter / X",
  "Facebook",
  "LinkedIn",
  "Threads",
  "Instagram",
  "YouTube",
  "TikTok",
] as const;

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

export async function getContactFormOptionsData() {
  const [accounts, contactTypes, leadSources, leadStatuses, leadTypes] =
    await Promise.all([
      prismadb.crm_Accounts.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.crm_Contact_Types.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.crm_Lead_Sources.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.crm_Lead_Statuses.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.crm_Lead_Types.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return {
    accounts,
    contactTypes,
    leadSources: appendSocialLeadSourceOptions(leadSources),
    leadStatuses,
    leadTypes,
  };
}
