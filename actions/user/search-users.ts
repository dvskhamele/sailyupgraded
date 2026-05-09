"use server";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth-server";

import { prismadb } from "@/lib/prisma";

const PAGE_SIZE_MAX = 100;

export async function searchUsers({
  search = "",
  skip = 0,
  take = 50,
}: {
  search?: string;
  skip?: number;
  take?: number;
} = {}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const safeTake = Math.min(PAGE_SIZE_MAX, Math.max(1, take));
  const safeSkip = Math.max(0, skip);
  const searchTerms = search.trim().split(/\s+/).filter(Boolean);

  const where: Prisma.UsersWhereInput = {
    userStatus: "ACTIVE" as const,
    ...(searchTerms.length
      ? {
          AND: searchTerms.map((term) => ({
            name: { contains: term },
          })),
        }
      : {}),
  };

  const [users, total] = await prismadb.$transaction([
    prismadb.users.findMany({
      where,
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
      skip: safeSkip,
      take: safeTake,
    }),
    prismadb.users.count({ where }),
  ]);

  return { users, total, hasMore: safeSkip + safeTake < total };
}
