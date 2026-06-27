import { prismadb } from "@/lib/prisma";

export type OrganizationRole = "admin" | "member" | "viewer";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

export async function findCurrentOrganizationForUser(
  userId: string,
): Promise<CurrentOrganization | null> {
  try {
    const membership = await prismadb.OrganizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      ...membership.organization,
      role: membership.role,
    };
  } catch (e) {
    // If tables don't exist (P2021) or other errors, return null
    console.warn("[findCurrentOrganizationForUser] Error:", e);
    return null;
  }
}
