import type { ActivityWithLinks } from "@/actions/crm/activities/get-activities-by-entity";
import { normalizeContactNotes } from "@/lib/crm/notes";

export type CrmTimelineEventType =
  | "note"
  | "activity"
  | "assignment"
  | "opportunity";

export type CrmTimelineEvent = {
  id: string;
  type: CrmTimelineEventType;
  title: string;
  description?: string | null;
  contactId?: string;
  createdAt: string;
  href?: string;
  metadata?: Record<string, unknown>;
};

type TimelineProduct = {
  id: string;
  createdAt: string | Date;
  status: string;
  product: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
};

function asDate(value: unknown, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function uniqueEvents(events: CrmTimelineEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.type}:${event.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildContactTimelineEvents({
  contact,
  activities,
  products,
}: {
  contact: any;
  activities: ActivityWithLinks[];
  products: TimelineProduct[];
}) {
  const contactCreatedAt = asDate(contact.created_on ?? contact.createdAt, new Date());
  const contactId = contact.id as string | undefined;
  const opportunities = Array.isArray(contact.opportunities)
    ? contact.opportunities.map((item: any) => item.opportunity).filter(Boolean)
    : [];

  const events: CrmTimelineEvent[] = [
    ...normalizeContactNotes(contact.notes, contactCreatedAt).map((note) => ({
      id: note.id,
      type: "note" as const,
      title: "Note",
      description: note.text,
      contactId,
      createdAt: note.createdAt,
      metadata: { source: "contact.notes" },
    })),
    ...activities.map((activity) => ({
      id: activity.id,
      type: "activity" as const,
      title: activity.title,
      description: activity.description,
      contactId,
      createdAt: asDate(activity.date, contactCreatedAt).toISOString(),
      metadata: {
        activityType: activity.type,
        status: activity.status,
        outcome: activity.outcome,
      },
    })),
    ...products.map((item) => ({
      id: item.id,
      type: "assignment" as const,
      title: item.product?.name ?? "Product assigned",
      description: item.account ? `Linked through ${item.account.name}` : null,
      contactId,
      createdAt: asDate(item.createdAt, contactCreatedAt).toISOString(),
      href: item.product ? `/crm/products/${item.product.id}` : undefined,
      metadata: {
        status: item.status,
        accountId: item.account?.id,
        productId: item.product?.id,
      },
    })),
    ...opportunities.map((opportunity: any) => ({
      id: opportunity.id,
      type: "opportunity" as const,
      title: opportunity.name ?? "Opportunity created",
      description: opportunity.description,
      contactId,
      createdAt: asDate(opportunity.created_on ?? opportunity.createdAt, contactCreatedAt).toISOString(),
      href: `/crm/opportunities/${opportunity.id}`,
      metadata: {
        status: opportunity.status,
        stageId: opportunity.sales_stage,
      },
    })),
  ];

  return uniqueEvents(events).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
