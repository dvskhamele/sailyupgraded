"use client";

import {
  OFFLINE_SYNC_EVENT,
  OFFLINE_SYNC_META_KEY,
  OFFLINE_SYNC_QUEUE_KEY,
  type OfflineSyncMeta,
  type OfflineSyncMutationInput,
  type OfflineSyncQueueItem,
} from "@/lib/offline-sync/types";

const defaultMeta: OfflineSyncMeta = {
  state: "idle",
  pendingCount: 0,
  failedCount: 0,
};

class OfflineSyncRequestError extends Error {
  constructor(
    message: string,
    public readonly queueable: boolean,
  ) {
    super(message);
    this.name = "OfflineSyncRequestError";
  }
}

function hasWindow() {
  return typeof window !== "undefined";
}

function createQueueItem(input: OfflineSyncMutationInput): OfflineSyncQueueItem {
  const now = new Date().toISOString();

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    entity: input.entity,
    operation: input.operation,
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
  };
}

export function readOfflineSyncQueue(): OfflineSyncQueueItem[] {
  if (!hasWindow()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineSyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function writeOfflineSyncQueue(queue: OfflineSyncQueueItem[]) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function readOfflineSyncMeta(): OfflineSyncMeta {
  if (!hasWindow()) {
    return defaultMeta;
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_SYNC_META_KEY);
    return raw ? { ...defaultMeta, ...(JSON.parse(raw) as OfflineSyncMeta) } : defaultMeta;
  } catch {
    return defaultMeta;
  }
}

export function writeOfflineSyncMeta(meta: OfflineSyncMeta) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(OFFLINE_SYNC_META_KEY, JSON.stringify(meta));
}

function emitOfflineSyncChanged() {
  if (!hasWindow()) {
    return;
  }

  window.dispatchEvent(new Event(OFFLINE_SYNC_EVENT));
}

function persistStatus(partial: Partial<OfflineSyncMeta>) {
  const queue = readOfflineSyncQueue();
  const failedCount = queue.filter((item) => Boolean(item.lastError)).length;
  const state =
    partial.state ??
    (!navigator.onLine
      ? "offline"
      : failedCount > 0
        ? "error"
        : queue.length > 0
          ? "queued"
          : "idle");

  writeOfflineSyncMeta({
    ...readOfflineSyncMeta(),
    ...partial,
    state,
    pendingCount: queue.length,
    failedCount,
  });
  emitOfflineSyncChanged();
}

export async function enqueueOfflineMutation(input: OfflineSyncMutationInput) {
  const queue = readOfflineSyncQueue();
  queue.push(createQueueItem(input));
  writeOfflineSyncQueue(queue);
  persistStatus({
    state: navigator.onLine ? "queued" : "offline",
  });
}

async function postOfflineSyncMutation(input: OfflineSyncMutationInput) {
  const response = await fetch("/api/offline-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json()) as { error?: string; data?: unknown };

  if (!response.ok || result.error) {
    throw new OfflineSyncRequestError(result.error || "Sync request failed", false);
  }

  return result;
}

export async function executeOfflineSyncMutation(input: OfflineSyncMutationInput) {
  if (!hasWindow()) {
    return { error: "Offline sync is only available in the browser." };
  }

  if (!navigator.onLine) {
    await enqueueOfflineMutation(input);
    return { queued: true as const };
  }

  try {
    const result = await postOfflineSyncMutation(input);
    persistStatus({
      state: "idle",
      lastSyncAt: new Date().toISOString(),
      lastError: undefined,
    });
    return { queued: false as const, data: result.data };
  } catch (error) {
    if (error instanceof OfflineSyncRequestError && !error.queueable) {
      persistStatus({
        state: "error",
        lastError: error.message,
      });
      return { error: error.message };
    }

    await enqueueOfflineMutation(input);
    persistStatus({
      state: "queued",
      lastError: error instanceof Error ? error.message : "Network sync failed",
    });
    return { queued: true as const };
  }
}

export async function flushOfflineSyncQueue() {
  if (!hasWindow()) {
    return { processed: 0, failed: 0, refreshed: false };
  }

  const queue = readOfflineSyncQueue();
  if (queue.length === 0) {
    persistStatus({ state: navigator.onLine ? "idle" : "offline" });
    return { processed: 0, failed: 0, refreshed: false };
  }

  if (!navigator.onLine) {
    persistStatus({ state: "offline" });
    return { processed: 0, failed: queue.length, refreshed: false };
  }

  persistStatus({ state: "syncing", lastError: undefined });

  const remaining: OfflineSyncQueueItem[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await postOfflineSyncMutation({
        entity: item.entity,
        operation: item.operation,
        payload: item.payload,
      });
      processed += 1;
    } catch (error) {
      if (error instanceof OfflineSyncRequestError && !error.queueable) {
        failed += 1;
        continue;
      }

      failed += 1;
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  writeOfflineSyncQueue(remaining);
  persistStatus({
    state: remaining.length > 0 ? "error" : "idle",
    lastSyncAt: new Date().toISOString(),
    lastError: remaining[0]?.lastError,
  });

  return {
    processed,
    failed,
    refreshed: processed > 0,
  };
}
