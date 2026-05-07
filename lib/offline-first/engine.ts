"use client";

import { emitOfflineFirstChanged } from "@/lib/offline-first/events";
import { offlineIdResolver } from "@/lib/offline-first/id-resolver";
import { offlineFirstStorage } from "@/lib/offline-first/storage";
import type {
  MutationCommand,
  OfflineSyncSnapshot,
  PullResult,
  ResourceSyncConfig,
  SyncTransport,
} from "@/lib/offline-first/types";

const LAST_SYNC_META_PREFIX = "offline-first:last-sync:";

function nowIso() {
  return new Date().toISOString();
}

function plusBackoff(attempt: number) {
  const seconds = Math.min(300, 2 ** Math.max(1, attempt));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function mergeServerRecord(
  result: PullResult,
  updatedAtField = "updated_at",
) {
  const local =
    (await offlineFirstStorage.getRecord(result.storeName, result.id)) ??
    (result.serverId
      ? await offlineFirstStorage.getRecord(result.storeName, result.serverId)
      : null);

  const localUpdatedAt =
    (local?.data?.[updatedAtField] as string | undefined) ??
    local?.updatedAt ??
    "";

  if (local && localUpdatedAt && localUpdatedAt > result.updatedAt) {
    return;
  }

  await offlineFirstStorage.putRecord(result.storeName, result.id, {
    serverId: result.serverId ?? result.id,
    data: result.data,
    syncStatus: "synced",
    deleted: result.deleted,
    createdAt: local?.createdAt ?? result.updatedAt,
    updatedAt: result.updatedAt,
    lastSyncedAt: nowIso(),
  });
}

export class OfflineSyncEngine {
  private syncTimer?: number;
  private pullTimer?: number;
  private running = false;
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;
  private currentState: OfflineSyncSnapshot = {
    state: "idle",
    pendingCount: 0,
    failedCount: 0,
  };

  constructor(
    private readonly configs: ResourceSyncConfig[],
    private readonly transport: SyncTransport,
    private readonly syncIntervalMs = 15_000,
    private readonly pullIntervalMs = 5 * 60 * 1000,
  ) {}

  getSnapshot() {
    return this.currentState;
  }

  async refreshSnapshot(partial: Partial<OfflineSyncSnapshot> = {}) {
    const [pendingCount, failedCount, lastSyncAt, lastError] = await Promise.all([
      offlineFirstStorage.countMutationsByStatus("pending"),
      offlineFirstStorage.countMutationsByStatus("failed"),
      offlineFirstStorage.getMeta(`${LAST_SYNC_META_PREFIX}global`),
      offlineFirstStorage.getMeta("offline-first:last-error"),
    ]);

    this.currentState = {
      state: !navigator.onLine
        ? "offline"
        : failedCount > 0
          ? "error"
          : partial.state ?? this.currentState.state ?? "idle",
      pendingCount,
      failedCount,
      lastSyncAt: lastSyncAt ?? undefined,
      lastError: lastError ?? undefined,
      ...partial,
    };

    emitOfflineFirstChanged();
    return this.currentState;
  }

  start() {
    if (this.running || typeof window === "undefined") {
      return;
    }

    this.running = true;
    void this.refreshSnapshot();

    this.onlineHandler = () => {
      void this.flush();
    };
    this.offlineHandler = () => {
      void this.refreshSnapshot({ state: "offline" });
    };

    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);

    this.syncTimer = window.setInterval(() => {
      void this.flush();
    }, this.syncIntervalMs);

    this.pullTimer = window.setInterval(() => {
      void this.pull();
    }, this.pullIntervalMs);

    void this.flush();
    void this.pull();
  }

  stop() {
    this.running = false;
    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
    }
    if (this.pullTimer) {
      window.clearInterval(this.pullTimer);
    }
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
    }
    if (this.offlineHandler) {
      window.removeEventListener("offline", this.offlineHandler);
    }
  }

  private findConfig(storeName: string) {
    return this.configs.find((config) => config.storeName === storeName);
  }

  private async markMutation(
    command: MutationCommand,
    partial: Partial<MutationCommand>,
  ) {
    const nextCommand: MutationCommand = {
      ...command,
      ...partial,
      updatedAt: nowIso(),
    };
    await offlineFirstStorage.putMutation(nextCommand);
    return nextCommand;
  }

  async flush() {
    if (typeof window === "undefined") {
      return;
    }

    if (!navigator.onLine) {
      await this.refreshSnapshot({ state: "offline" });
      return;
    }

    const queue = await offlineFirstStorage.listPendingMutations();
    if (queue.length === 0) {
      await this.refreshSnapshot({ state: "idle" });
      return;
    }

    await this.refreshSnapshot({ state: "syncing", lastError: undefined });

    for (const command of queue) {
      const config = this.findConfig(command.storeName);
      if (!config) {
        await this.markMutation(command, {
          status: "failed",
          error: `Missing sync config for store ${command.storeName}`,
          nextRetryAt: plusBackoff(command.attempts + 1),
          attempts: command.attempts + 1,
        });
        continue;
      }

      const record = await offlineFirstStorage.getRecord(command.storeName, command.recordId);
      const resolvedPayload = await offlineIdResolver.replaceForeignKeys(
        command.payload,
        config.foreignKeyMap,
      );

      const activeCommand = await this.markMutation(command, { status: "processing" });
      const result = await this.transport.push(
        {
          ...activeCommand,
          payload: resolvedPayload,
          endpoint:
            command.operation === "create"
              ? config.baseUrl
              : `${config.baseUrl}/${await offlineIdResolver.resolveServerId(config.storeName, command.recordId)}`,
        },
        config,
      );

      if (!result.ok) {
        const attempts = activeCommand.attempts + 1;
        await this.markMutation(activeCommand, {
          status: result.retryable === false ? "failed" : "pending",
          attempts,
          error: result.error ?? "Sync failed",
          nextRetryAt: result.retryable === false ? undefined : plusBackoff(attempts),
        });
        await offlineFirstStorage.putMeta(
          "offline-first:last-error",
          result.error ?? "Sync failed",
        );
        continue;
      }

      if (result.serverId && command.recordId !== result.serverId) {
        await offlineIdResolver.link(config.storeName, command.recordId, result.serverId);
      }

      if (record) {
        const finalId = result.serverId ?? command.recordId;
        if (command.operation === "delete") {
          await offlineFirstStorage.deleteRecord(command.storeName, command.recordId);
        } else {
          await offlineFirstStorage.putRecord(command.storeName, finalId, {
            ...record,
            serverId: result.serverId ?? record.serverId ?? finalId,
            data: (result.record as Record<string, unknown>) ?? record.data,
            syncStatus: "synced",
            deleted: false,
            updatedAt: result.updatedAt ?? nowIso(),
            lastSyncedAt: nowIso(),
          });

          if (finalId !== command.recordId) {
            await offlineFirstStorage.deleteRecord(command.storeName, command.recordId);
          }
        }
      }

      await offlineFirstStorage.deleteMutation(activeCommand.id);
      await offlineFirstStorage.putMeta(
        `${LAST_SYNC_META_PREFIX}${config.storeName}`,
        nowIso(),
      );
      await offlineFirstStorage.putMeta(`${LAST_SYNC_META_PREFIX}global`, nowIso());
    }

    await this.refreshSnapshot({ state: "idle" });
  }

  async pull() {
    if (typeof window === "undefined" || !navigator.onLine) {
      return;
    }

    for (const config of this.configs) {
      const since = await offlineFirstStorage.getMeta(
        `${LAST_SYNC_META_PREFIX}${config.storeName}`,
      );
      const results = await this.transport.pull(config, since ?? undefined);

      for (const result of results) {
        await mergeServerRecord(result, config.updatedAtField ?? "updated_at");
        if (result.serverId && result.id !== result.serverId) {
          await offlineIdResolver.link(config.storeName, result.id, result.serverId);
        }
      }

      await offlineFirstStorage.putMeta(
        `${LAST_SYNC_META_PREFIX}${config.storeName}`,
        nowIso(),
      );
    }

    await offlineFirstStorage.putMeta(`${LAST_SYNC_META_PREFIX}global`, nowIso());
    await this.refreshSnapshot({ state: "idle" });
  }
}
