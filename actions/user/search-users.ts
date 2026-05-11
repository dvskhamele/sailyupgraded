"use server";
import { getSession } from "@/lib/auth-server";

import { getActiveUsersForSearch } from "@/lib/crm/agent-search";

export async function searchUsers({
  search = "",
  skip = 0,
  take = 50,
}: {
  search?: string;
  skip?: number;
  take?: number;
} = {}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  return getActiveUsersForSearch({ search, skip, take });
}
