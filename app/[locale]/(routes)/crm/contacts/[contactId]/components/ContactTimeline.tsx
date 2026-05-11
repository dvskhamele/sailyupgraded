"use client";

import Link from "next/link";
import { FileText, ListChecks, Package, TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CrmTimelineEvent } from "@/lib/crm/timeline-events";

const typeIcons = {
  note: FileText,
  activity: ListChecks,
  assignment: Package,
  opportunity: TrendingUp,
} as const;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ContactTimeline({
  events,
}: {
  events: CrmTimelineEvent[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No timeline events yet.
          </p>
        ) : (
          <div className="space-y-4">
            {events.slice(0, 50).map((item) => {
              const Icon = typeIcons[item.type];
              const title = item.href ? (
                <Link href={item.href} className="font-medium hover:underline">
                  {item.title}
                </Link>
              ) : (
                <span className="font-medium">{item.title}</span>
              );

              return (
                <div key={`${item.type}-${item.id}`} className="flex gap-3">
                  <div className="mt-1 rounded-full border bg-background p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 border-b pb-4 last:border-b-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm">{title}</p>
                      <time className="text-xs text-muted-foreground">
                        {formatDate(new Date(item.createdAt))}
                      </time>
                    </div>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
