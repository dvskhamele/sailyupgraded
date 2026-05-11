import type { Prisma } from "@prisma/client";

import { prismadb } from "@/lib/prisma";

const PAGE_SIZE_MAX = 100;

export async function getActiveUsersForSearch({
  search = "",
  skip = 0,
  take = 50,
}: {
  search?: string;
  skip?: number;
  take?: number;
} = {}) {
  const safeTake = Math.min(PAGE_SIZE_MAX, Math.max(1, take));
  const safeSkip = Math.max(0, skip);
  const searchTerms = search.trim().split(/\s+/).filter(Boolean);

  const where: Prisma.UsersWhereInput = {
    userStatus: "ACTIVE" as const,
    ...(searchTerms.length
      ? {
          AND: searchTerms.map((term) => ({
            OR: [
              { name: { contains: term } },
              { email: { contains: term } },
            ],
          })),
        }
      : {}),
  };

  const [users, total] = await prismadb.$transaction([
    prismadb.users.findMany({
      where,
      select: { id: true, name: true, email: true, avatar: true },
      orderBy: { name: "asc" },
      skip: safeSkip,
      take: safeTake,
    }),
    prismadb.users.count({ where }),
  ]);

  return { users, total, hasMore: safeSkip + safeTake < total };
}
