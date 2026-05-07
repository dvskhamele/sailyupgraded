"use client";

export type OfflineOperation = "create" | "update" | "delete";
export type SyncStatus = "pending" | "processing" | "synced" | "failed";

export type OfflineRecord<TData extends Record<string, unknown> = Record<string, unknown>> = {
  key: string;
  storeName: string;
  id: string;
  serverId?: string;
  data: TData;
  syncStatus: SyncStatus;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
};

export type MutationCommand<TData extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  storeName: string;
  recordId: string;
  operation: OfflineOperation;
  endpoint: string;
  payload: TData;
  status: SyncStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
  error?: string;
};

export type IdMapEntry = {
  key: string;
  storeName: string;
  localId: string;
  serverId: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncMeta = {
  key: string;
  value: string;
  updatedAt: string;
};

export type OfflineSyncSnapshot = {
  state: "idle" | "offline" | "syncing" | "error";
  pendingCount: number;
  failedCount: number;
  lastSyncAt?: string;
  lastError?: string;
};

export type PushResult = {
  ok: boolean;
  serverId?: string;
  record?: Record<string, unknown>;
  updatedAt?: string;
  retryable?: boolean;
  error?: string;
};

export type PullResult = {
  storeName: string;
  id: string;
  serverId?: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deleted?: boolean;
};

export type ResourceSyncConfig = {
  storeName: string;
  baseUrl: string;
  pullUrl?: string;
  primaryKey?: string;
  updatedAtField?: string;
  foreignKeyMap?: Record<string, string>;
};

export type SyncTransport = {
  push: (
    command: MutationCommand,
    config: ResourceSyncConfig,
  ) => Promise<PushResult>;
  pull: (
    config: ResourceSyncConfig,
    since?: string,
  ) => Promise<PullResult[]>;
};

