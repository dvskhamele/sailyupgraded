"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type AutoSaveDomFormOptions = {
  key: string;
  formRef: RefObject<HTMLFormElement | null>;
  enabled?: boolean;
};

const AUTOSAVE_DELAY_MS = 800;

function getFieldValue(element: Element) {
  if (element instanceof HTMLInputElement) {
    if (element.type === "file" || element.type === "password") return undefined;
    if (element.type === "checkbox") return element.checked;
    if (element.type === "radio") return element.checked ? element.value : undefined;
    return element.value;
  }

  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }

  if (element instanceof HTMLSelectElement) {
    return element.multiple
      ? Array.from(element.selectedOptions).map((option) => option.value)
      : element.value;
  }

  return undefined;
}

function setFieldValue(element: Element, value: unknown) {
  if (element instanceof HTMLInputElement) {
    if (element.type === "file" || element.type === "password") return;
    if (element.type === "checkbox") {
      element.checked = Boolean(value);
      return;
    }
    if (element.type === "radio") {
      element.checked = element.value === value;
      return;
    }
    element.value = typeof value === "string" ? value : value == null ? "" : String(value);
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = typeof value === "string" ? value : value == null ? "" : String(value);
    return;
  }

  if (element instanceof HTMLSelectElement) {
    if (element.multiple && Array.isArray(value)) {
      for (const option of Array.from(element.options)) {
        option.selected = value.includes(option.value);
      }
      return;
    }
    element.value = typeof value === "string" ? value : value == null ? "" : String(value);
  }
}

function getControlName(control: Element) {
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement ||
    control instanceof HTMLSelectElement
  ) {
    return control.name;
  }

  return "";
}

function readFormSnapshot(form: HTMLFormElement) {
  const snapshot: Record<string, unknown> = {};
  const controls = Array.from(form.elements);

  for (const control of controls) {
    const name = getControlName(control);
    if (!name) continue;

    const value = getFieldValue(control);
    if (value === undefined) continue;
    snapshot[name] = value;
  }

  return snapshot;
}

function restoreFormSnapshot(form: HTMLFormElement, snapshot: Record<string, unknown>) {
  const controls = Array.from(form.elements);

  for (const control of controls) {
    const name = getControlName(control);
    if (!name || !(name in snapshot)) continue;
    setFieldValue(control, snapshot[name]);
  }
}

export function useAutoSaveDomForm({
  key,
  formRef,
  enabled = true,
}: AutoSaveDomFormOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") return;

    const form = formRef.current;
    if (!form) return;

    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue) {
        restoreFormSnapshot(form, JSON.parse(storedValue) as Record<string, unknown>);
        lastSavedRef.current = storedValue;
      }
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore storage access failures.
      }
    }

    const flush = () => {
      const latest = JSON.stringify(readFormSnapshot(form));
      if (latest === lastSavedRef.current) return;

      try {
        window.localStorage.setItem(key, latest);
        lastSavedRef.current = latest;
      } catch {
        // Ignore storage access failures.
      }
    };

    const scheduleSave = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
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

    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      form.removeEventListener("input", scheduleSave);
      form.removeEventListener("change", scheduleSave);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, formRef, key]);

  const clearDraft = () => {
    if (!key || typeof window === "undefined") return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage access failures.
    }
    lastSavedRef.current = null;
  };

  return { clearDraft };
}

export default useAutoSaveDomForm;
