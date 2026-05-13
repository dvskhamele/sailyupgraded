import { prismadb } from "@/lib/prisma";

export async function resolveExistingUserId(
  preferredUserId?: string | null,
  fallbackUserId?: string | null,
) {
  const preferred = preferredUserId?.trim() || null;
  const fallback = fallbackUserId?.trim() || null;
  const candidates = Array.from(
    new Set([preferred, fallback].filter((id): id is string => Boolean(id))),
  );

  if (candidates.length === 0) return null;

  const users = await prismadb.users.findMany({
    where: { id: { in: candidates } },
    select: { id: true },
  });
  const existingIds = new Set(users.map((user) => user.id));

  if (preferred && existingIds.has(preferred)) return preferred;
  if (fallback && existingIds.has(fallback)) return fallback;

  return null;
}

export function connectUserById(userId?: string | null) {
  return userId ? { connect: { id: userId } } : undefined;
}
