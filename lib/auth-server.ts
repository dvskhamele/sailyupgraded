import { cache } from "react";

import { auth } from "@/lib/auth";
import { setOrganizationContext } from "@/lib/organization-context";
import { findCurrentOrganizationForUser } from "@/lib/organization-queries";
import { isTransientPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import { headers } from "next/headers";

// TODO: Add requireRole() helper for viewer restriction enforcement
// when viewer role is first assigned to users

const bypassLogin =
  process.env.BYPASS_LOGIN === "true" ||
  process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

type BaseSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export type AppSession = NonNullable<BaseSession> & {
  user: NonNullable<BaseSession>["user"] & {
    organizationId: string | null;
    organizationRole: "admin" | "member" | "viewer" | null;
  };
};

export type OrganizationRole = AppSession["user"]["organizationRole"];

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
      organizationId: null,
      organizationRole: null,
      image: null,
      avatar: null,
      banned: false,
      emailVerified: true,
    },
  } as unknown as AppSession;
}

async function enrichSessionWithOrganization(
  session: BaseSession | AppSession,
): Promise<AppSession | null> {
  if (!session?.user?.id) {
    return null;
  }

  let organization = null;
  try {
    organization = await findCurrentOrganizationForUser(session.user.id);
  } catch (error) {
    console.warn(
      "[AUTH_ORGANIZATION_SESSION]",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    ...session,
    user: {
      ...session.user,
      organizationId: organization?.id ?? null,
      organizationRole: organization?.role ?? null,
    },
  } as AppSession;
}

async function loadSession(): Promise<AppSession | null> {
  const requestHeaders = await headers();

  try {
    return await withPrismaRetry(async () => {
      const session = await auth.api.getSession({
        headers: requestHeaders,
      });
      return enrichSessionWithOrganization(
        session ?? (bypassLogin ? createGuestSession() : null),
      );
    });
  } catch (error) {
    if (isTransientPrismaConnectionError(error)) {
      console.warn(
        "[AUTH_GET_SESSION] database pool timeout after retry; continuing without session.",
      );
    } else {
      console.warn(
        "[AUTH_GET_SESSION]",
        error instanceof Error ? error.message : error,
      );
    }

    return bypassLogin ? createGuestSession() : null;
  }
}

export const getSession = cache(loadSession);

export async function requireOrganization() {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new Error("Authentication is required");
  }

  if (!session.user.organizationId) {
    throw new Error("Organization context is required");
  }

  return {
    session,
    organizationId: session.user.organizationId,
    role: session.user.organizationRole,
  };
}

export async function requireOrganizationId() {
  const { organizationId } = await requireOrganization();
  return organizationId;
}

export async function requireRole(
  allowedRoles: Exclude<OrganizationRole, null>[],
) {
  const organization = await requireOrganization();

  if (!organization.role || !allowedRoles.includes(organization.role)) {
    throw new Error("Insufficient organization permissions");
  }

  return organization;
}
