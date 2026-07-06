"use server";

import { prismadb } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

const PAGE_SIZE_MAX = 100;

export async function searchAccounts({
  search = "",
  skip = 0,
  take = 50,
}: {
  search?: string;
  skip?: number;
  take?: number;
} = {}) {
  const organizationId = await requireOrganizationId();
  const safeTake = Math.min(PAGE_SIZE_MAX, Math.max(1, take));
  const safeSkip = Math.max(0, skip);

  const where = search
    ? { name: { contains: search, mode: "insensitive" as const }, organizationId, deletedAt: null }
    : { organizationId, deletedAt: null };

  return runWithOrganizationContext(organizationId, async () => {
    const [accounts, total] = await prismadb.$transaction([
      prismadb.crm_Accounts.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        skip: safeSkip,
        take: safeTake,
      }),
      prismadb.crm_Accounts.count({ where }),
    ]);

    return { accounts, total, hasMore: safeSkip + safeTake < total };
  });
}
