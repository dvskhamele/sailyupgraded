"use server";
import { cache } from "react";
import {
  isTransientPrismaConnectionError,
  prisma,
  withPrismaRetry,
} from "@/lib/prisma";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { getActivityAssignees, getActivityIdsAssignedTo } from "./activity-assignment";
import {
  type ActivityLinkWithContact,
  withActivityContactLinks,
} from "./activity-contact-links";

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
  links: ActivityLinkWithContact[];
  // Retail AI Fields
  isRetailAI?: boolean;
  aiSource?: string | null;
  aiStatus?: string | null;
  aiConfidenceScore?: number | null;
  aiGeneratedSummary?: string | null;
  aiInsights?: string | null;
  aiMetadata?: unknown;
  retailAIPayload?: unknown;
  conversationId?: string | null;
  webhookReceivedAt?: Date | null;
  sentiment?: string | null;
  callSuccessful?: boolean | null;
  recordingUrl?: string | null;
  publicLogUrl?: string | null;
  transcript?: any;

  // New Retail AI Fields
  call_id?: string | null;
  customer_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  appointment_time?: Date | null;
  call_summary?: string | null;
  call_successful?: string | null;
  user_sentiment?: string | null;
  combined_cost?: number | null;
  call_duration?: number | null;

  // Additional Extraction Fields
  state?: string | null;
  location?: string | null;
  timezone?: string | null;
  insurance_interest?: string | null;
  smoker_status?: string | null;
  call_outcome?: string | null;
  consultation_type?: string | null;
};

export type ActivityCursor = { date: string; id: string };

export type ActivityFilters = {
  type?: ActivityWithLinks["type"] | "all";
  status?: ActivityWithLinks["status"] | "all";
  contactId?: string;
  assignedTo?: string;
  aiStatus?: string;
  sentiment?: string;
  minAIConfidence?: number;
  maxAIConfidence?: number;
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
    let assignedStandardActivityIds: string[] | null = null;
    
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
      assignedStandardActivityIds = await getActivityIdsAssignedTo(prisma, filters.assignedTo);
      andClauses.push({ id: { in: assignedStandardActivityIds } });
    }

    if (cursor && cursorDate) {
      const cursorClause = {
        OR: [
          { date: { lt: cursorDate } },
          { date: cursorDate, id: { lt: cursor.id } },
        ],
      };
      andClauses.push(cursorClause);
    }

    let standardActivities: any[] = [];
    if (assignedStandardActivityIds?.length !== 0) {
      standardActivities = (await withPrismaRetry(() =>
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
      )) as any[];
    }

    const activities = serializeDecimalsList(standardActivities).map(a => ({
      ...a,
      isRetailAI: false,
    }));

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

    const activitiesWithContactLinks = await withActivityContactLinks(
      prisma,
      activitiesWithAssignees
    );

    const nextCursor =
      activitiesWithContactLinks.length < PAGE_SIZE
        ? null
        : {
            date: activitiesWithContactLinks[activitiesWithContactLinks.length - 1].date.toISOString(),
            id: activitiesWithContactLinks[activitiesWithContactLinks.length - 1].id,
          };

    return { data: activitiesWithContactLinks as ActivityWithLinks[], nextCursor };
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
