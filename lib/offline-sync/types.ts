export const OFFLINE_SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const OFFLINE_SYNC_QUEUE_KEY = "offline-sync.queue.v1";
export const OFFLINE_SYNC_META_KEY = "offline-sync.meta.v1";
export const OFFLINE_SYNC_EVENT = "offline-sync:changed";

export type OfflineSyncEntity =
  | "account"
  | "contact"
  | "lead"
  | "opportunity";

export type OfflineSyncOperation = "create" | "update";

export type OfflineSyncState =
  | "offline"
  | "idle"
  | "queued"
  | "syncing"
  | "error";

export type OfflineSyncQueueItem = {
  id: string;
  entity: OfflineSyncEntity;
  operation: OfflineSyncOperation;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
};

export type OfflineSyncMeta = {
  state: OfflineSyncState;
  pendingCount: number;
  failedCount: number;
  lastSyncAt?: string;
  lastError?: string;
};

export type OfflineSyncMutationInput = {
  entity: OfflineSyncEntity;
  operation: OfflineSyncOperation;
  payload: Record<string, unknown>;
};
