"use client";

import { useEffect } from "react";

export function OfflineRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/offline-sw.js").catch(() => {
      // Keep registration failures silent in production UI.
    });
  }, []);

  return null;
}

