import { auth } from "@/lib/auth";
import { isTransientPrismaConnectionError, resetPrisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

// TODO: Add requireRole() helper for viewer restriction enforcement
// when viewer role is first assigned to users

const bypassLogin =
  process.env.BYPASS_LOGIN === "true" ||
  process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

export type AuthSession =
  | null
  | { type: "guest" }
  | {
      type: "user";
      user: {
        id: string;
        email: string;
        name: string | null;
        role?: string;
        userStatus?: string;
        userLanguage?: string;
        image?: string | null;
        avatar?: string | null;
      };
      session: {
        id: string;
        token: string;
        userId: string;
        expiresAt: Date;
        createdAt: Date;
        updatedAt: Date;
        ipAddress: string | null;
        userAgent: string;
      };
    };

function createGuestSession(): AuthSession {
  return { type: "guest" };
}

async function hasGuestSessionCookie() {
  const cookieStore = await cookies();
  return (
    cookieStore.get("guestMode")?.value === "true" &&
    cookieStore.get("token")?.value === "guest"
  );
}

export async function getSession(): Promise<AuthSession> {
  const requestHeaders = await headers();
  const guestSession = await hasGuestSessionCookie();

  try {
    const originalSession = await auth.api.getSession({
      headers: requestHeaders,
    });

    if (originalSession) {
      return {
        type: "user",
        user: {
          id: originalSession.user.id,
          email: originalSession.user.email,
          name: originalSession.user.name,
          role: (originalSession.user as any).role,
          userStatus: (originalSession.user as any).userStatus,
          userLanguage: (originalSession.user as any).userLanguage,
          image: originalSession.user.image,
          avatar: (originalSession.user as any).avatar,
        },
        session: originalSession.session,
      };
    }

    return bypassLogin || guestSession ? createGuestSession() : null;
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) {
      console.warn(
        "[AUTH_GET_SESSION]",
        error instanceof Error ? error.message : error,
      );
      return bypassLogin || guestSession ? createGuestSession() : null;
    }

    await resetPrisma();
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const originalSession = await auth.api.getSession({
        headers: requestHeaders,
      });

      if (originalSession) {
        return {
          type: "user",
          user: {
            id: originalSession.user.id,
            email: originalSession.user.email,
            name: originalSession.user.name,
            role: (originalSession.user as any).role,
            userStatus: (originalSession.user as any).userStatus,
            userLanguage: (originalSession.user as any).userLanguage,
            image: originalSession.user.image,
            avatar: (originalSession.user as any).avatar,
          },
          session: originalSession.session,
        };
      }

      return bypassLogin || guestSession ? createGuestSession() : null;
    } catch {
      console.warn(
        "[AUTH_GET_SESSION] database pool timeout after retry; continuing without session.",
      );
      return bypassLogin || guestSession ? createGuestSession() : null;
    }
  }
}
