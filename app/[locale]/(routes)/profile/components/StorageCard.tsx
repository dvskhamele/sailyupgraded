"use client";

import { useEffect, useMemo, useState } from "react";

import { calculatePercentage, formatBytes } from "@/lib/storage-usage";

type StorageUsage = {
  totalStorage: number;
  usedStorage: number;
  remainingStorage: number;
  usagePercentage: number;
};

type StorageState =
  | { status: "loading" }
  | { status: "ready"; data: StorageUsage }
  | { status: "empty" }
  | { status: "error" };

function isStorageUsage(value: unknown): value is StorageUsage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.totalStorage === "number" &&
    typeof candidate.usedStorage === "number" &&
    typeof candidate.remainingStorage === "number" &&
    typeof candidate.usagePercentage === "number"
  );
}

function getStorageStatus(percentage: number) {
  if (percentage >= 100) {
    return {
      label: "Full",
      badgeClass: "bg-red-50 text-red-700 ring-red-200",
      barClass: "from-red-500 to-red-600",
      helper: "Uploads disabled",
    };
  }

  if (percentage >= 80) {
    return {
      label: "Warning",
      badgeClass: "bg-yellow-50 text-yellow-700 ring-yellow-200",
      barClass: "from-yellow-400 to-yellow-500",
      helper: "Storage is almost full",
    };
  }

  return {
    label: "Safe",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    barClass: "from-blue-500 to-emerald-500",
    helper: "Uploads available",
  };
}

function StorageCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

export function StorageCard() {
  const [state, setState] = useState<StorageState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadStorageUsage() {
      try {
        const response = await fetch("/api/storage", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setState({ status: "error" });
          return;
        }

        const payload: unknown = await response.json();
        if (!isStorageUsage(payload) || payload.totalStorage <= 0) {
          setState({ status: "empty" });
          return;
        }

        setState({ status: "ready", data: payload });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    }

    void loadStorageUsage();

    return () => controller.abort();
  }, []);

  const display = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    const usagePercentage = calculatePercentage(
      state.data.usedStorage,
      state.data.totalStorage,
    );

    return {
      ...state.data,
      usagePercentage,
      status: getStorageStatus(usagePercentage),
    };
  }, [state]);

  if (state.status === "loading") {
    return <StorageCardSkeleton />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-card-foreground">Storage Usage</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Storage usage could not be loaded right now.
        </p>
      </div>
    );
  }

  if (state.status === "empty" || !display) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-card-foreground">Storage Usage</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No storage usage data is available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Storage Usage</h3>
          <p className="mt-1 text-xs text-muted-foreground">{display.status.helper}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${display.status.badgeClass}`}
        >
          {display.status.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${display.status.barClass} transition-all duration-700 ease-out`}
            style={{ width: `${display.usagePercentage}%` }}
          />
        </div>
        <span className="w-11 text-right text-sm font-semibold text-card-foreground">
          {display.usagePercentage}%
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Used</dt>
          <dd className="mt-1 font-medium text-card-foreground">
            {formatBytes(display.usedStorage)}
          </dd>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Remaining</dt>
          <dd className="mt-1 font-medium text-card-foreground">
            {formatBytes(display.remainingStorage)}
          </dd>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="mt-1 font-medium text-card-foreground">
            {formatBytes(display.totalStorage)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
