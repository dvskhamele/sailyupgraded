"use client";

import { emitOfflineFirstChanged } from "@/lib/offline-first/events";
import type {
  IdMapEntry,
  MutationCommand,
  OfflineRecord,
  SyncMeta,
} from "@/lib/offline-first/types";

const DB_NAME = "saily-offline-first";
const DB_VERSION = 1;

const RECORDS_STORE = "records";
const MUTATIONS_STORE = "mutations";
const ID_MAP_STORE = "idMap";
const META_STORE = "meta";

function makeRecordKey(storeName: string, id: string) {
  return `${storeName}:${id}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        const store = db.createObjectStore(RECORDS_STORE, { keyPath: "key" });
        store.createIndex("by_store", "storeName", { unique: false });
        store.createIndex("by_store_updated", ["storeName", "updatedAt"], {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        const store = db.createObjectStore(MUTATIONS_STORE, { keyPath: "id" });
        store.createIndex("by_status", "status", { unique: false });
        store.createIndex("by_record", ["storeName", "recordId"], {
          unique: false,
        });
        store.createIndex("by_retry", ["status", "nextRetryAt"], {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(ID_MAP_STORE)) {
        const store = db.createObjectStore(ID_MAP_STORE, { keyPath: "key" });
        store.createIndex("by_server", ["storeName", "serverId"], {
          unique: true,
        });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class OfflineFirstStorage {
  private dbPromise?: Promise<IDBDatabase>;

  private getDb() {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase();
    }

    return this.dbPromise;
  }

  private async withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    runner: (store: IDBObjectStore) => Promise<T>,
  ) {
    const db = await this.getDb();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await runner(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  }

  async putRecord<TData extends Record<string, unknown>>(
    storeName: string,
    id: string,
    input: Omit<OfflineRecord<TData>, "key" | "storeName" | "id">,
  ) {
    const record: OfflineRecord<TData> = {
      key: makeRecordKey(storeName, id),
      storeName,
      id,
      ...input,
    };

    await this.withStore(RECORDS_STORE, "readwrite", async (store) => {
      await requestToPromise(store.put(record));
      return undefined;
    });
    emitOfflineFirstChanged();
    return record;
  }

  async getRecord<TData extends Record<string, unknown>>(
    storeName: string,
    id: string,
  ) {
    return this.withStore(RECORDS_STORE, "readonly", async (store) => {
      const record = await requestToPromise(
        store.get(makeRecordKey(storeName, id)),
      );
      return (record as OfflineRecord<TData> | undefined) ?? null;
    });
  }

  async listRecords<TData extends Record<string, unknown>>(storeName: string) {
    return this.withStore(RECORDS_STORE, "readonly", async (store) => {
      const index = store.index("by_store");
      const records = await requestToPromise(index.getAll(storeName));
      return (records as OfflineRecord<TData>[]).sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : -1,
      );
    });
  }

  async deleteRecord(storeName: string, id: string) {
    await this.withStore(RECORDS_STORE, "readwrite", async (store) => {
      await requestToPromise(store.delete(makeRecordKey(storeName, id)));
      return undefined;
    });
    emitOfflineFirstChanged();
  }

  async putMutation(command: MutationCommand) {
    await this.withStore(MUTATIONS_STORE, "readwrite", async (store) => {
      await requestToPromise(store.put(command));
      return undefined;
    });
    emitOfflineFirstChanged();
    return command;
  }

  async getMutation(id: string) {
    return this.withStore(MUTATIONS_STORE, "readonly", async (store) => {
      const command = await requestToPromise(store.get(id));
      return (command as MutationCommand | undefined) ?? null;
    });
  }

  async listPendingMutations(nowIso = new Date().toISOString()) {
    return this.withStore(MUTATIONS_STORE, "readonly", async (store) => {
      const all = (await requestToPromise(store.getAll())) as MutationCommand[];
      return all
        .filter((item) => {
          if (item.status === "pending") {
            return !item.nextRetryAt || item.nextRetryAt <= nowIso;
          }
          return item.status === "failed" && Boolean(item.nextRetryAt) && item.nextRetryAt <= nowIso;
        })
        .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    });
  }

  async deleteMutation(id: string) {
    await this.withStore(MUTATIONS_STORE, "readwrite", async (store) => {
      await requestToPromise(store.delete(id));
      return undefined;
    });
    emitOfflineFirstChanged();
  }

  async countMutationsByStatus(status: MutationCommand["status"]) {
    return this.withStore(MUTATIONS_STORE, "readonly", async (store) => {
      const index = store.index("by_status");
      const count = await requestToPromise(index.count(status));
      return count;
    });
  }

  async putIdMap(entry: Omit<IdMapEntry, "key">) {
    const nextEntry: IdMapEntry = {
      key: makeRecordKey(entry.storeName, entry.localId),
      ...entry,
    };

    await this.withStore(ID_MAP_STORE, "readwrite", async (store) => {
      await requestToPromise(store.put(nextEntry));
      return undefined;
    });
    emitOfflineFirstChanged();
    return nextEntry;
  }

  async getIdMap(storeName: string, localId: string) {
    return this.withStore(ID_MAP_STORE, "readonly", async (store) => {
      const entry = await requestToPromise(store.get(makeRecordKey(storeName, localId)));
      return (entry as IdMapEntry | undefined) ?? null;
    });
  }

  async getIdMapByServerId(storeName: string, serverId: string) {
    return this.withStore(ID_MAP_STORE, "readonly", async (store) => {
      const index = store.index("by_server");
      const entry = await requestToPromise(index.get([storeName, serverId]));
      return (entry as IdMapEntry | undefined) ?? null;
    });
  }

  async putMeta(key: string, value: string) {
    const entry: SyncMeta = {
      key,
      value,
      updatedAt: new Date().toISOString(),
    };

    await this.withStore(META_STORE, "readwrite", async (store) => {
      await requestToPromise(store.put(entry));
      return undefined;
    });
    emitOfflineFirstChanged();
  }

  async getMeta(key: string) {
    return this.withStore(META_STORE, "readonly", async (store) => {
      const entry = await requestToPromise(store.get(key));
      return (entry as SyncMeta | undefined)?.value ?? null;
    });
  }
}

export const offlineFirstStorage = new OfflineFirstStorage();

