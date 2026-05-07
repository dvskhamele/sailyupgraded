"use client";

import { offlineFirstStorage } from "@/lib/offline-first/storage";
import { offlineIdResolver } from "@/lib/offline-first/id-resolver";
import type {
  MutationCommand,
  OfflineOperation,
  OfflineRecord,
  ResourceSyncConfig,
} from "@/lib/offline-first/types";

function nowIso() {
  return new Date().toISOString();
}

function createCommandId() {
  return crypto.randomUUID();
}

export class OfflineMutationQueue {
  async writeThrough<TData extends Record<string, unknown>>(
    config: ResourceSyncConfig,
    operation: OfflineOperation,
    input: {
      id?: string;
      data: TData;
      endpoint?: string;
      deleted?: boolean;
    },
  ) {
    const id = input.id ?? offlineIdResolver.createLocalId(config.storeName);
    const now = nowIso();
    const existing = await offlineFirstStorage.getRecord<TData>(config.storeName, id);
    const nextData =
      operation === "delete"
        ? (existing?.data ?? input.data)
        : { ...(existing?.data ?? {}), ...input.data };

    const record: Omit<OfflineRecord<TData>, "key" | "storeName" | "id"> = {
      serverId: existing?.serverId,
      data: nextData,
      syncStatus: "pending",
      deleted: input.deleted ?? operation === "delete",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSyncedAt: existing?.lastSyncedAt,
    };

    await offlineFirstStorage.putRecord(config.storeName, id, record);

    const command: MutationCommand = {
      id: createCommandId(),
      storeName: config.storeName,
      recordId: id,
      operation,
      endpoint:
        input.endpoint ??
        (operation === "create" ? config.baseUrl : `${config.baseUrl}/${id}`),
      payload: nextData,
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    await offlineFirstStorage.putMutation(command);
    return { id, record, command };
  }
}

export const offlineMutationQueue = new OfflineMutationQueue();

