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
  const membership = await prismadb.organizationMember.findFirst({
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
}
