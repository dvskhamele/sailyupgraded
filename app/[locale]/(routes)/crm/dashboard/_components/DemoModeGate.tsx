"use client";

import { useEffect, useState } from "react";

export function DemoModeGate() {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("token");
    const guestMode = window.localStorage.getItem("guestMode") === "true";

    if (!token) {
      window.location.href = "/en/sign-in";
      return;
    }

    setIsDemoMode(guestMode);
  }, []);

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
      You are in Demo Mode. Login is required to save, delete, export, or change CRM data.
    </div>
  );
}
