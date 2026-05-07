"use client";

import type {
  PullResult,
  PushResult,
  ResourceSyncConfig,
  SyncTransport,
} from "@/lib/offline-first/types";

function buildDeltaUrl(baseUrl: string, since?: string) {
  const url = new URL(baseUrl, window.location.origin);
  if (since) {
    url.searchParams.set("since", since);
  }
  return url.toString();
}

export class HttpSyncTransport implements SyncTransport {
  async push(command: Parameters<SyncTransport["push"]>[0], config: ResourceSyncConfig): Promise<PushResult> {
    const method =
      command.operation === "create"
        ? "POST"
        : command.operation === "update"
          ? "PATCH"
          : "DELETE";

    try {
      const response = await fetch(command.endpoint || config.baseUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: method === "DELETE" ? undefined : JSON.stringify(command.payload),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          retryable: response.status >= 500,
          error: payload?.error || `HTTP ${response.status}`,
        };
      }

      const record = payload?.data ?? payload ?? null;
      return {
        ok: true,
        serverId:
          record?.id ??
          record?.server_id ??
          undefined,
        record: record ?? undefined,
        updatedAt:
          record?.updated_at ??
          record?.updatedAt ??
          undefined,
      };
    } catch (error) {
      return {
        ok: false,
        retryable: true,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  async pull(config: ResourceSyncConfig, since?: string): Promise<PullResult[]> {
    const target = config.pullUrl ?? config.baseUrl;
    try {
      const response = await fetch(buildDeltaUrl(target, since), {
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

      return rows.map((row: Record<string, unknown>) => ({
        storeName: config.storeName,
        id: String(
          row[config.primaryKey ?? "id"] ??
            row.id ??
            row.server_id,
        ),
        serverId: String(
          row[config.primaryKey ?? "id"] ??
            row.id ??
            row.server_id,
        ),
        data: row,
        updatedAt: String(
          row[config.updatedAtField ?? "updated_at"] ??
            row.updatedAt ??
            new Date().toISOString(),
        ),
        deleted: Boolean(row.deleted),
      }));
    } catch {
      return [];
    }
  }
}

export const httpSyncTransport = new HttpSyncTransport();

