"use client";

import { enqueueOfflineMutation, flushOfflineSyncQueue } from "@/lib/offline-sync/client";
import { emitOfflineFirstChanged, subscribeOfflineFirstChanged } from "@/lib/offline-first/events";
import { offlineMutationQueue } from "@/lib/offline-first/queue";
import { offlineFirstStorage } from "@/lib/offline-first/storage";
import type { UnifiedPersonFormValues } from "@/components/crm/unified-person-form";
import type { ResourceSyncConfig } from "@/lib/offline-first/types";

type AccountOption = {
  id: string;
  name: string;
};

const CONTACTS_STORE = "contacts";

export const contactsOfflineConfig: ResourceSyncConfig = {
  storeName: CONTACTS_STORE,
  baseUrl: "/api/crm/contacts",
  primaryKey: "id",
  updatedAtField: "updatedAt",
};

function nowIso() {
  return new Date().toISOString();
}

function buildAssignedAccount(accounts: AccountOption[], assignedAccountId?: string | null) {
  if (!assignedAccountId) {
    return null;
  }

  const match = accounts.find((account) => account.id === assignedAccountId);
  return match ? { id: match.id, name: match.name } : null;
}

function normalizeContactPayload(
  values: UnifiedPersonFormValues,
  accounts: AccountOption[] = [],
) {
  const timestamp = nowIso();

  return {
    ...values,
    created_on: timestamp,
    updatedAt: timestamp,
    assigned_accounts: buildAssignedAccount(accounts, values.assigned_account),
    assigned_to_user: null,
  };
}

async function triggerBackgroundContactSync() {
  try {
    if (typeof window !== "undefined" && navigator.onLine) {
      void flushOfflineSyncQueue();
    }
  } catch {
    // Keep local-first writes non-blocking.
  }
}

export async function queueCreateContactOffline(
  values: UnifiedPersonFormValues,
  accounts: AccountOption[] = [],
) {
  const payload = normalizeContactPayload(values, accounts);

  const writeResult = await offlineMutationQueue.writeThrough(
    contactsOfflineConfig,
    "create",
    {
      data: payload,
    },
  );

  await enqueueOfflineMutation({
    entity: "contact",
    operation: "create",
    payload,
  });

  emitOfflineFirstChanged();
  void triggerBackgroundContactSync();

  return {
    queued: true as const,
    localId: writeResult.id,
  };
}

export async function queueUpdateContactOffline(
  values: UnifiedPersonFormValues,
  accounts: AccountOption[] = [],
) {
  if (!values.id) {
    return { error: "Contact ID is required for update." };
  }

  const existing = await offlineFirstStorage.getRecord<Record<string, unknown>>(
    CONTACTS_STORE,
    values.id,
  );

  const payload = {
    ...(existing?.data ?? {}),
    ...normalizeContactPayload(values, accounts),
    id: values.id,
  };

  await offlineMutationQueue.writeThrough(
    contactsOfflineConfig,
    "update",
    {
      id: values.id,
      data: payload,
    },
  );

  await enqueueOfflineMutation({
    entity: "contact",
    operation: "update",
    payload,
  });

  emitOfflineFirstChanged();
  void triggerBackgroundContactSync();

  return {
    queued: true as const,
    localId: values.id,
  };
}

export async function hydrateContactsIntoOfflineStore(
  contacts: Array<Record<string, unknown>>,
) {
  for (const contact of contacts) {
    const id = String(contact.id);
    const existing = await offlineFirstStorage.getRecord<Record<string, unknown>>(
      CONTACTS_STORE,
      id,
    );

    if (existing?.syncStatus === "pending") {
      continue;
    }

    await offlineFirstStorage.putRecord(CONTACTS_STORE, id, {
      serverId: id,
      data: contact,
      syncStatus: "synced",
      deleted: false,
      createdAt: String(contact.created_on ?? contact.updatedAt ?? nowIso()),
      updatedAt: String(contact.updatedAt ?? contact.created_on ?? nowIso()),
      lastSyncedAt: nowIso(),
    });
  }
}

export async function readOfflineFirstContacts() {
  const records = await offlineFirstStorage.listRecords<Record<string, unknown>>(CONTACTS_STORE);
  return records
    .filter((record) => !record.deleted)
    .map((record) => ({
      ...record.data,
      id: record.id,
      _offline: record.syncStatus !== "synced",
      _syncStatus: record.syncStatus,
    }));
}

export function subscribeContactsOfflineStore(listener: () => void) {
  return subscribeOfflineFirstChanged(listener);
}

