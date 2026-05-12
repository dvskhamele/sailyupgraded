import { auth } from "@/lib/auth";
import { isTransientPrismaConnectionError, resetPrisma } from "@/lib/prisma";
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
  const requestHeaders = await headers();

  try {
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    return session ?? (bypassLogin ? createGuestSession() : null);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) {
      console.warn(
        "[AUTH_GET_SESSION]",
        error instanceof Error ? error.message : error,
      );
      return bypassLogin ? createGuestSession() : null;
    }

    await resetPrisma();
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const session = await auth.api.getSession({
        headers: requestHeaders,
      });
      return session ?? (bypassLogin ? createGuestSession() : null);
    } catch {
      console.warn(
        "[AUTH_GET_SESSION] database pool timeout after retry; continuing without session.",
      );
      return bypassLogin ? createGuestSession() : null;
    }
  }
}
