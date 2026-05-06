"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  flushOfflineSyncQueue,
  readOfflineSyncMeta,
} from "@/lib/offline-sync/client";
import {
  OFFLINE_SYNC_EVENT,
  OFFLINE_SYNC_INTERVAL_MS,
  type OfflineSyncMeta,
} from "@/lib/offline-sync/types";

const initialOfflineSyncMeta: OfflineSyncMeta = {
  state: "idle",
  pendingCount: 0,
  failedCount: 0,
};

function formatLastSync(lastSyncAt?: string) {
  if (!lastSyncAt) {
    return "Not synced yet";
  }

  return `Last sync ${new Date(lastSyncAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function OfflineSyncBadge() {
  const router = useRouter();
  const [meta, setMeta] = useState<OfflineSyncMeta>(initialOfflineSyncMeta);

  useEffect(() => {
    const syncNow = async () => {
      const result = await flushOfflineSyncQueue();
      setMeta(readOfflineSyncMeta());

      if (document.visibilityState === "visible" && result.refreshed) {
        router.refresh();
      }
    };

    const updateMeta = () => setMeta(readOfflineSyncMeta());
    const handleOnline = () => {
      void syncNow();
    };
    const handleOffline = () => {
      setMeta((current) => ({
        ...current,
        state: "offline",
      }));
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncNow();
      }
    };

    updateMeta();
    void syncNow();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncNow();
      }
    }, OFFLINE_SYNC_INTERVAL_MS);

    window.addEventListener(OFFLINE_SYNC_EVENT, updateMeta);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(OFFLINE_SYNC_EVENT, updateMeta);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  const badgeCopy =
    meta.state === "offline"
      ? `Offline${meta.pendingCount ? ` | ${meta.pendingCount} queued` : ""}`
      : meta.state === "syncing"
        ? "Syncing..."
        : meta.failedCount > 0
          ? `${meta.failedCount} sync failed`
          : meta.pendingCount > 0
            ? `${meta.pendingCount} queued`
            : "Synced";

  const badgeClassName =
    meta.state === "offline"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
      : meta.state === "syncing"
        ? "border-sky-500/40 bg-sky-500/10 text-sky-700"
        : meta.failedCount > 0
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge
        variant="outline"
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-sm ${badgeClassName}`}
        title={`${badgeCopy}. ${formatLastSync(meta.lastSyncAt)}. Auto sync runs every 5 minutes.`}
      >
        {meta.state === "offline" ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : meta.state === "syncing" ? (
          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wifi className="h-3.5 w-3.5" />
        )}
        <span>{badgeCopy}</span>
      </Badge>
    </div>
  );
}
