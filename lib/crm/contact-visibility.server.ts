import "server-only";

import type { Prisma } from "@prisma/client";
import { getExistingDbColumnNames } from "@/lib/prisma-model-fields";
import { buildContactVisibilityFilter } from "@/lib/crm/contact-visibility";

type ContactViewer = {
  id?: string | null;
  role?: string | null;
};

export async function buildExistingDbContactVisibilityFilter(
  viewer?: ContactViewer | null,
): Promise<Prisma.crm_ContactsWhereInput> {
  const columns = await getExistingDbColumnNames("crm_Contacts");

  return buildContactVisibilityFilter(viewer, columns.has("visible_to_name"));
}
