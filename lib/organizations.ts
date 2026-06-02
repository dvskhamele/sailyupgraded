import { getSession } from "@/lib/auth-server";
import { findCurrentOrganizationForUser } from "@/lib/organization-queries";

export async function getCurrentOrganization() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  return findCurrentOrganizationForUser(session.user.id);
}

export async function getCurrentUserRole() {
  const organization = await getCurrentOrganization();
  return organization?.role ?? null;
}
