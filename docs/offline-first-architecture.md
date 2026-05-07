# Offline-First Architecture

This project now includes generic offline-first primitives under `lib/offline-first/`.

## Modules

- `storage.ts`: IndexedDB wrapper with stores for records, mutations, ID mapping, and sync metadata.
- `queue.ts`: Write-through local mutation logger for create/update/delete.
- `id-resolver.ts`: Temporary ID generation and `local_id -> server_id` reconciliation.
- `engine.ts`: Background push/pull sync engine with retry and last-write-wins merge logic.
- `http-transport.ts`: Default REST transport for `POST/PATCH/DELETE` push and delta pull.
- `react.ts`: React bridge for sync status subscriptions.
- `components/offline-first/offline-runtime.tsx`: Service worker registration hook.

## Record Model

Each local record is stored as:

- `storeName`
- `id`
- `serverId`
- `data`
- `syncStatus`
- `deleted`
- `createdAt`
- `updatedAt`
- `lastSyncedAt`

## Queue Model

Each mutation command stores:

- `operation`
- `storeName`
- `recordId`
- `endpoint`
- `payload`
- `status`
- `attempts`
- `nextRetryAt`

## Usage Example

```ts
import { OfflineSyncEngine } from "@/lib/offline-first/engine";
import { httpSyncTransport } from "@/lib/offline-first/http-transport";
import { offlineMutationQueue } from "@/lib/offline-first/queue";

const productConfig = {
  storeName: "products",
  baseUrl: "/api/products",
  pullUrl: "/api/products/delta",
  primaryKey: "id",
  updatedAtField: "updated_at",
};

const engine = new OfflineSyncEngine([productConfig], httpSyncTransport);

await offlineMutationQueue.writeThrough(productConfig, "create", {
  data: {
    name: "New product",
    price: 499,
    updated_at: new Date().toISOString(),
  },
});
```

## Conflict Strategy

The engine uses a simple last-write-wins rule:

- Compare local `updated_at` (or configured field) vs server `updated_at`
- Keep the newest record
- Server pull merges only overwrite older local state

## Service Worker

`public/offline-sw.js` caches the app shell and static assets for offline boot.

