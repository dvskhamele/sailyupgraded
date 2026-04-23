import { cache } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// TODO: Add requireRole() helper for viewer restriction enforcement
// when viewer role is first assigned to users

export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.error("[AUTH_GET_SESSION]", error);
    return null;
  }
});
