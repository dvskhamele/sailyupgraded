"use client";

const OFFLINE_FIRST_EVENT = "offline-first:changed";

const eventTarget =
  typeof window !== "undefined" ? window : new EventTarget();

export function emitOfflineFirstChanged() {
  eventTarget.dispatchEvent(new Event(OFFLINE_FIRST_EVENT));
}

export function subscribeOfflineFirstChanged(listener: () => void) {
  eventTarget.addEventListener(OFFLINE_FIRST_EVENT, listener);
  return () => eventTarget.removeEventListener(OFFLINE_FIRST_EVENT, listener);
}

