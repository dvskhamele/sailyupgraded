"use client";

import { useEffect, useState } from "react";

const GUEST_MODE_KEY = "guestMode";
const TOKEN_KEY = "token";
const GUEST_TOKEN = "guest";
const AUTHENTICATED_TOKEN = "authenticated";
const SIGN_IN_PATH = "/en/sign-in";
const DEMO_DASHBOARD_PATH = "/en/crm/dashboard";

export function startDemoMode() {
  window.localStorage.setItem(GUEST_MODE_KEY, "true");
  window.localStorage.setItem(TOKEN_KEY, GUEST_TOKEN);
  document.cookie = `${GUEST_MODE_KEY}=true; Path=/; SameSite=Lax`;
  document.cookie = `${TOKEN_KEY}=guest; Path=/; SameSite=Lax`;
  window.location.href = DEMO_DASHBOARD_PATH;
}

export function markAuthenticatedSession() {
  window.localStorage.removeItem(GUEST_MODE_KEY);
  window.localStorage.setItem(TOKEN_KEY, AUTHENTICATED_TOKEN);
  document.cookie = `${GUEST_MODE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${TOKEN_KEY}=authenticated; Path=/; SameSite=Lax`;
}

export function isGuestMode() {
  return window.localStorage.getItem(GUEST_MODE_KEY) === "true";
}

export function hasClientToken() {
  return Boolean(window.localStorage.getItem(TOKEN_KEY));
}

export function useDemoMode() {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    setDemoMode(isGuestMode());
  }, []);

  return demoMode;
}

export function guardDemoAction() {
  if (!isGuestMode()) {
    return true;
  }

  window.alert("Please login to continue");
  window.location.href = SIGN_IN_PATH;
  return false;
}
