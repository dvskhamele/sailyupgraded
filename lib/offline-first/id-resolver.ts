"use client";

import { offlineFirstStorage } from "@/lib/offline-first/storage";

function nowIso() {
  return new Date().toISOString();
}

export class OfflineIdResolver {
  createLocalId(prefix = "tmp") {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  async resolveServerId(storeName: string, localOrServerId: string) {
    if (!localOrServerId.startsWith("tmp_")) {
      return localOrServerId;
    }

    const mapping = await offlineFirstStorage.getIdMap(storeName, localOrServerId);
    return mapping?.serverId ?? localOrServerId;
  }

  async link(storeName: string, localId: string, serverId: string) {
    await offlineFirstStorage.putIdMap({
      storeName,
      localId,
      serverId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async replaceForeignKeys(
    payload: Record<string, unknown>,
    foreignKeyMap: Record<string, string> = {},
  ) {
    const nextPayload = { ...payload };

    for (const [fieldName, targetStore] of Object.entries(foreignKeyMap)) {
      const current = nextPayload[fieldName];
      if (typeof current === "string") {
        nextPayload[fieldName] = await this.resolveServerId(targetStore, current);
      }
    }

    return nextPayload;
  }
}

export const offlineIdResolver = new OfflineIdResolver();

