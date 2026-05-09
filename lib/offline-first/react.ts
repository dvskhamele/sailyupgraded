"use client";

import { useEffect, useSyncExternalStore } from "react";

import { subscribeOfflineFirstChanged } from "@/lib/offline-first/events";
import { OfflineSyncEngine } from "@/lib/offline-first/engine";
import type { OfflineSyncSnapshot } from "@/lib/offline-first/types";

const emptySnapshot: OfflineSyncSnapshot = {
  state: "idle",
  pendingCount: 0,
  failedCount: 0,
};

export function useOfflineSyncEngine(engine: OfflineSyncEngine | null) {
  useEffect(() => {
    if (!engine) {
      return;
    }

    engine.start();
    return () => engine.stop();
  }, [engine]);
}

export function useOfflineSyncSnapshot(engine: OfflineSyncEngine | null) {
  return useSyncExternalStore(
    subscribeOfflineFirstChanged,
    () => engine?.getSnapshot() ?? emptySnapshot,
    () => emptySnapshot,
  );
}
