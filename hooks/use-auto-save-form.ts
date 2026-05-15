"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

type AutoSaveFormOptions<T> = {
  key: string;
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  enabled?: boolean;
};

const AUTOSAVE_DELAY_MS = 800;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeForStorage(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStorage(item, seen));
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new TypeError("Circular structure");
    }

    seen.add(value);

    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeForStorage(value[key], seen);
    }

    seen.delete(value);
    return normalized;
  }

  return value;
}

function safeSerialize(value: unknown): string | null {
  try {
    const normalized = normalizeForStorage(value);
    const serialized = JSON.stringify(normalized);
    return serialized ?? null;
  } catch {
    return null;
  }
}

export function useAutoSaveForm<T>({
  key,
  data,
  setData,
  enabled = true,
}: AutoSaveFormOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const latestSerializedRef = useRef<string | null>(null);
  const suppressWritesRef = useRef(true);
  const restoredKeyRef = useRef<string | null>(null);
  const latestDataRef = useRef(data);
  const setDataRef = useRef(setData);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    setDataRef.current = setData;
  }, [setData]);

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") {
      return;
    }

    if (restoredKeyRef.current === key) {
      return;
    }

    suppressWritesRef.current = true;

    const currentSnapshot = safeSerialize(latestDataRef.current);
    let storedValue: string | null = null;

    try {
      storedValue = window.localStorage.getItem(key);
    } catch {
      storedValue = null;
    }

    if (storedValue !== null) {
      try {
        if (storedValue !== currentSnapshot) {
          const parsed = JSON.parse(storedValue) as T;
          lastSavedRef.current = storedValue;
          latestSerializedRef.current = storedValue;
          setDataRef.current(parsed);
        } else {
          lastSavedRef.current = currentSnapshot;
          latestSerializedRef.current = currentSnapshot;
        }
      } catch {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Ignore storage access failures.
        }
        lastSavedRef.current = currentSnapshot;
        latestSerializedRef.current = currentSnapshot;
      }
    } else {
      lastSavedRef.current = currentSnapshot;
      latestSerializedRef.current = currentSnapshot;
    }

    restoredKeyRef.current = key;

    queueMicrotask(() => {
      suppressWritesRef.current = false;
    });

  }, [enabled, key]);

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") {
      return;
    }

    const serialized = safeSerialize(data);
    latestSerializedRef.current = serialized;

    if (suppressWritesRef.current || serialized === null) {
      return;
    }

    if (serialized === lastSavedRef.current) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const latest = latestSerializedRef.current;
      if (latest === null || latest === lastSavedRef.current) {
        return;
      }

      try {
        window.localStorage.setItem(key, latest);
        lastSavedRef.current = latest;
      } catch {
        // Ignore storage access failures.
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [data, enabled, key]);

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") {
      return;
    }

    const flush = () => {
      const latest = latestSerializedRef.current;
      if (latest === null || latest === lastSavedRef.current) {
        return;
      }

      try {
        window.localStorage.setItem(key, latest);
        lastSavedRef.current = latest;
      } catch {
        // Ignore storage access failures.
      }
    };

    const handlePageHide = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handlePageHide();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, key]);

  const clearDraft = () => {
    if (!key || typeof window === "undefined") {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage access failures.
    }

    const serialized = safeSerialize(data);
    lastSavedRef.current = serialized;
    latestSerializedRef.current = serialized;
  };

  return { clearDraft };
}

export default useAutoSaveForm;
