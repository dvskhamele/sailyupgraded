"use server";
import { cache } from "react";
import {
  isTransientPrismaConnectionError,
  prisma,
  withPrismaRetry,
} from "@/lib/prisma";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { withActivityContactLinks } from "@/actions/crm/activities/activity-contact-links";
import type {
  RetailAIActivityCursor,
  RetailAIActivityFilters,
  RetailAIActivityWithLinks,
} from "./types";

const PAGE_SIZE = 25;
const VALID_ENTITY_TYPES = new Set([
  "account",
  "contact",
  "lead",
  "opportunity",
  "contract",
]);

const loadRetailAIActivities = cache(async (
  entityType: string | null,
  entityId: string | null,
  cursorKey: string | null,
  filtersKey: string | null,
): Promise<{ data: RetailAIActivityWithLinks[]; nextCursor: RetailAIActivityCursor | null }> => {
  const cursor = cursorKey ? (JSON.parse(cursorKey) as RetailAIActivityCursor) : undefined;
  const filters = filtersKey ? (JSON.parse(filtersKey) as RetailAIActivityFilters) : {};
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

    if (filters.aiStatus) {
      andClauses.push({ aiStatus: filters.aiStatus });
    }

    const confidence: Record<string, number> = {};
    if (typeof filters.minAIConfidence === "number") {
      confidence.gte = filters.minAIConfidence;
    }
    if (typeof filters.maxAIConfidence === "number") {
      confidence.lte = filters.maxAIConfidence;
    }
    if (Object.keys(confidence).length > 0) {
      andClauses.push({ aiConfidenceScore: confidence });
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
      andClauses.push({ assignedTo: filters.assignedTo });
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
      (prisma as any).crm_RetailAIActivities.findMany({
        where: { AND: andClauses },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: PAGE_SIZE,
        include: {
          created_by_user: { select: { id: true, name: true, avatar: true } },
          assigned_to_user: { select: { id: true, name: true, avatar: true } },
          links: { select: { id: true, entityType: true, entityId: true } },
        },
      })
    )) as RetailAIActivityWithLinks[];

    const activitiesWithContacts = await withActivityContactLinks(
      prisma,
      serializeDecimalsList(activities) as RetailAIActivityWithLinks[],
    );

    const nextCursor =
      activitiesWithContacts.length < PAGE_SIZE
        ? null
        : {
            date: activitiesWithContacts[activitiesWithContacts.length - 1].date.toISOString(),
            id: activitiesWithContacts[activitiesWithContacts.length - 1].id,
          };

    return { data: activitiesWithContacts, nextCursor };
  } catch (error) {
    if (isTransientPrismaConnectionError(error)) {
      console.warn("getRetailAIActivities skipped after database pool timeout.");
    } else {
      console.warn(
        "getRetailAIActivities failed:",
        error instanceof Error ? error.message : error,
      );
    }

    return { data: [], nextCursor: null };
  }
});

export const getRetailAIActivitiesByEntity = async (
  entityType: string,
  entityId: string,
  cursor?: RetailAIActivityCursor,
  filters?: RetailAIActivityFilters,
): Promise<{ data: RetailAIActivityWithLinks[]; nextCursor: RetailAIActivityCursor | null }> => {
  const cursorKey = cursor ? JSON.stringify(cursor) : null;
  const filtersKey = filters ? JSON.stringify(filters) : null;
  return loadRetailAIActivities(entityType, entityId, cursorKey, filtersKey);
};

export const getRetailAIActivities = async (
  cursor?: RetailAIActivityCursor,
  filters?: RetailAIActivityFilters,
): Promise<{ data: RetailAIActivityWithLinks[]; nextCursor: RetailAIActivityCursor | null }> => {
  const cursorKey = cursor ? JSON.stringify(cursor) : null;
  const filtersKey = filters ? JSON.stringify(filters) : null;
  return loadRetailAIActivities(null, null, cursorKey, filtersKey);
};
