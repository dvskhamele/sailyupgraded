"use client";

import type { KeyboardEvent, MouseEvent, SyntheticEvent } from "react";

const INTERACTIVE_ROW_TARGETS = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  "[role='button']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[data-row-action]",
].join(",");

function isInteractiveRowTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest(INTERACTIVE_ROW_TARGETS))
  );
}

export function handleRowClick(
  event: MouseEvent<HTMLElement>,
  navigate: () => void
) {
  if (isInteractiveRowTarget(event.target)) return;
  navigate();
}

export function handleRowKeyDown(
  event: KeyboardEvent<HTMLElement>,
  navigate: () => void
) {
  if (isInteractiveRowTarget(event.target)) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  navigate();
}

export function stopRowNavigation(event: SyntheticEvent) {
  event.stopPropagation();
}
