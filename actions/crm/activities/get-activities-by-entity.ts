"use server";
import { cache } from "react";
import {
  isTransientPrismaConnectionError,
  prisma,
  withPrismaRetry,
} from "@/lib/prisma";
import { getActivityAssignees, getActivityIdsAssignedTo } from "./activity-assignment";

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
  assignedTo: string | null;
  created_by_user: { id: string; name: string | null; avatar: string | null } | null;
  assigned_to_user: { id: string; name: string | null; avatar: string | null } | null;
  links: Array<{ id: string; entityType: string; entityId: string }>;
};

export type ActivityCursor = { date: string; id: string };

export type ActivityFilters = {
  type?: ActivityWithLinks["type"] | "all";
  status?: ActivityWithLinks["status"] | "all";
  contactId?: string;
  assignedTo?: string;
};

const loadActivities = cache(async (
  entityType: string | null,
  entityId: string | null,
  cursorKey: string | null,
  filtersKey: string | null
): Promise<{ data: ActivityWithLinks[]; nextCursor: ActivityCursor | null }> => {
  const cursor = cursorKey ? (JSON.parse(cursorKey) as ActivityCursor) : undefined;
  const filters = filtersKey ? (JSON.parse(filtersKey) as ActivityFilters) : {};
  const cursorDate = cursor ? new Date(cursor.date) : null;

  if (entityType && (!VALID_ENTITY_TYPES.has(entityType) || !entityId)) {
    return { data: [], nextCursor: null };
  }

  if (cursorDate && Number.isNaN(cursorDate.getTime())) {
    return { data: [], nextCursor: null };
  }

  try {
    const andClauses: Record<string, unknown>[] = [{ deletedAt: null }];
    const type = filters.type && filters.type !== "all" ? filters.type : null;
    const status = filters.status && filters.status !== "all" ? filters.status : null;

    if (type) {
      andClauses.push({ type });
    }

    if (status) {
      andClauses.push({ status });
    }

    if (entityType && entityId) {
      andClauses.push({
        links: {
          some: { entityType, entityId },
        },
      });
    }

    if (!entityType && filters.contactId) {
      andClauses.push({
        links: {
          some: { entityType: "contact", entityId: filters.contactId },
        },
      });
    }

    if (filters.assignedTo) {
      const assignedActivityIds = await getActivityIdsAssignedTo(prisma, filters.assignedTo);
      if (assignedActivityIds.length === 0) {
        return { data: [], nextCursor: null };
      }
      andClauses.push({ id: { in: assignedActivityIds } });
    }

    if (cursor && cursorDate) {
      andClauses.push({
        OR: [
          { date: { lt: cursorDate } },
          { date: cursorDate, id: { lt: cursor.id } },
        ],
      });
    }

    const activities = (await withPrismaRetry(() =>
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
    )) as Omit<ActivityWithLinks, "assignedTo" | "assigned_to_user">[];

    const assignees = await getActivityAssignees(
      prisma,
      activities.map((activity) => activity.id)
    );
    const activitiesWithAssignees = activities.map((activity) => ({
      ...activity,
      ...(assignees.get(activity.id) ?? {
        assignedTo: null,
        assigned_to_user: null,
      }),
    }));

    const nextCursor =
      activitiesWithAssignees.length < PAGE_SIZE
        ? null
        : {
            date: activitiesWithAssignees[activitiesWithAssignees.length - 1].date.toISOString(),
            id: activitiesWithAssignees[activitiesWithAssignees.length - 1].id,
          };

    return { data: activitiesWithAssignees, nextCursor };
  } catch (error) {
    if (isTransientPrismaConnectionError(error)) {
      console.warn(
        `getActivities skipped after database pool timeout for ${entityType ?? "global"}:${entityId ?? "all"}.`,
      );
    } else {
      console.warn(
        "getActivities failed:",
        error instanceof Error ? error.message : error,
      );
    }

    return { data: [], nextCursor: null };
  }
});

export const getActivitiesByEntity = async (
  entityType: string,
  entityId: string,
  cursor?: ActivityCursor,
  filters?: ActivityFilters
): Promise<{ data: ActivityWithLinks[]; nextCursor: ActivityCursor | null }> => {
  const cursorKey = cursor ? JSON.stringify(cursor) : null;
  const filtersKey = filters ? JSON.stringify(filters) : null;
  return loadActivities(entityType, entityId, cursorKey, filtersKey);
};

export const getActivities = async (
  cursor?: ActivityCursor,
  filters?: ActivityFilters
): Promise<{ data: ActivityWithLinks[]; nextCursor: ActivityCursor | null }> => {
  const cursorKey = cursor ? JSON.stringify(cursor) : null;
  const filtersKey = filters ? JSON.stringify(filters) : null;
  return loadActivities(null, null, cursorKey, filtersKey);
};
