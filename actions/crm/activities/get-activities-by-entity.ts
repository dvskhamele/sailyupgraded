"use server";
import { cache } from "react";
import {
  isTransientPrismaConnectionError,
  prisma,
  withPrismaRetry,
} from "@/lib/prisma";

const PAGE_SIZE = 25;
const VALID_ENTITY_TYPES = new Set([
  "account",
  "contact",
  "lead",
  "opportunity",
  "contract",
]);

export type ActivityWithLinks = {
  id: string;
  type: "call" | "meeting" | "note" | "email";
  title: string;
  description: string | null;
  date: Date;
  duration: number | null;
  outcome: string | null;
  status: "scheduled" | "completed" | "cancelled";
  metadata: unknown;
  createdAt: Date;
  createdBy: string | null;
  created_by_user: { id: string; name: string | null; avatar: string | null } | null;
  links: Array<{ id: string; entityType: string; entityId: string }>;
};

export type ActivityCursor = { date: string; id: string };

const loadActivitiesByEntity = cache(async (
  entityType: string,
  entityId: string,
  cursorKey: string | null
): Promise<{ data: ActivityWithLinks[]; nextCursor: ActivityCursor | null }> => {
  const cursor = cursorKey ? (JSON.parse(cursorKey) as ActivityCursor) : undefined;
  const cursorDate = cursor ? new Date(cursor.date) : null;

  if (!VALID_ENTITY_TYPES.has(entityType) || !entityId) {
    return { data: [], nextCursor: null };
  }

  if (cursorDate && Number.isNaN(cursorDate.getTime())) {
    return { data: [], nextCursor: null };
  }

  try {
    const andClauses: Record<string, unknown>[] = [
      {
        deletedAt: null,
        links: {
          some: { entityType, entityId },
        },
      },
    ];

    if (cursor && cursorDate) {
      andClauses.push({
        OR: [
          { date: { lt: cursorDate } },
          { date: cursorDate, id: { lt: cursor.id } },
        ],
      });
    }

    const activities = await withPrismaRetry(() =>
      (prisma as any).crm_Activities.findMany({
        where: { AND: andClauses },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: PAGE_SIZE,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          date: true,
          duration: true,
          outcome: true,
          status: true,
          metadata: true,
          createdAt: true,
          createdBy: true,
          created_by_user: { select: { id: true, name: true, avatar: true } },
          links: { select: { id: true, entityType: true, entityId: true } },
        },
      })
    ) as ActivityWithLinks[];

    const nextCursor =
      activities.length < PAGE_SIZE
        ? null
        : {
            date: activities[activities.length - 1].date.toISOString(),
            id: activities[activities.length - 1].id,
          };

    return { data: activities as ActivityWithLinks[], nextCursor };
  } catch (error) {
    if (isTransientPrismaConnectionError(error)) {
      console.warn(
        `getActivitiesByEntity skipped after database pool timeout for ${entityType}:${entityId}.`,
      );
    } else {
      console.warn(
        "getActivitiesByEntity failed:",
        error instanceof Error ? error.message : error,
      );
    }

    return { data: [], nextCursor: null };
  }
});

export const getActivitiesByEntity = async (
  entityType: string,
  entityId: string,
  cursor?: ActivityCursor
): Promise<{ data: ActivityWithLinks[]; nextCursor: ActivityCursor | null }> => {
  const cursorKey = cursor ? JSON.stringify(cursor) : null;
  return loadActivitiesByEntity(entityType, entityId, cursorKey);
};
