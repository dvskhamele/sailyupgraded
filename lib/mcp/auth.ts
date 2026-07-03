import { validateApiToken } from "@/lib/api-tokens";
import { getSession } from "@/lib/auth-server";
import { setOrganizationContext } from "@/lib/organization-context";
import { findCurrentOrganizationForUser } from "@/lib/organization-queries";

export interface McpUser {
  id: string;
  organizationId: string;
}

async function createMcpUser(userId: string): Promise<McpUser> {
  const organization = await findCurrentOrganizationForUser(userId);

  if (!organization) {
    throw new Error("Organization context is required");
  }

  setOrganizationContext(organization.id);
  return { id: userId, organizationId: organization.id };
}

export async function getMcpUser(): Promise<McpUser> {
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const authHeader = hdrs.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (bearer?.startsWith("nxtc__")) {
    const userId = await validateApiToken(bearer);
    return createMcpUser(userId);
  }

  // Development-only fallback: better-auth session cookie
  // Not used in production — session cannot substitute for token revocation
  if (process.env.NODE_ENV === "development") {
    const session = await getSession();
    if (session?.user?.id && session.user.organizationId) {
      return { id: session.user.id, organizationId: session.user.organizationId };
    }
  }

  throw new Error("Unauthorized");
}
