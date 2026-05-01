import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// TODO: Add requireRole() helper for viewer restriction enforcement
// when viewer role is first assigned to users

const bypassLogin =
  process.env.BYPASS_LOGIN === "true" ||
  process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

function createGuestSession() {
  const now = new Date();
  return {
    session: {
      id: "guest-session",
      token: "guest-session",
      userId: "guest-user",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: "guest",
    },
    user: {
      id: "guest-user",
      createdAt: now,
      updatedAt: now,
      email: "guest@example.com",
      name: "Guest User",
      role: "admin",
      userStatus: "ACTIVE",
      userLanguage: "en",
      image: null,
      avatar: null,
      banned: false,
      emailVerified: true,
    },
  } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>;
}

export async function getSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session ?? (bypassLogin ? createGuestSession() : null);
  } catch (error) {
    console.error("[AUTH_GET_SESSION]", error);
    return bypassLogin ? createGuestSession() : null;
  }
}
