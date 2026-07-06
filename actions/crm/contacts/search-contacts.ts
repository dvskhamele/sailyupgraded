"use server";

import { prismadb } from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import type { Prisma } from "@prisma/client";
import { runWithOrganizationContext } from "@/lib/organization-context";

export type ContactSearchItem = {
  id: string;
  serial: string | null;
  first_name: string | null;
  last_name: string;
  email: string | null;
};

interface SearchContactsParams {
  search: string;
  take?: number;
}

export const searchContacts = async ({
  search,
  take = 10,
}: SearchContactsParams): Promise<ContactSearchItem[]> => {
  const session = await getSession();
  const organizationId = await requireOrganizationId();

  if (!session) {
    return [];
  }

  const trimmedSearch = search.trim();

  if (trimmedSearch.length < 2) {
    return [];
  }

  const isEmailSearch = trimmedSearch.includes("@");
  const digitsOnlySearch = trimmedSearch.replace(/\D/g, "");
  const normalizedPhoneSearch = trimmedSearch.replace(/[^\d+]/g, "");
  const isPhoneSearch =
    !isEmailSearch &&
    /^[\d+\s().-]+$/.test(trimmedSearch) &&
    digitsOnlySearch.length >= 2;

  let orConditions: Prisma.crm_ContactsWhereInput[] = [];

  if (isEmailSearch) {
    orConditions = [
      { serial: { contains: trimmedSearch } },
      { email: { contains: trimmedSearch } },
      { personal_email: { contains: trimmedSearch } },
    ];
  } else if (isPhoneSearch) {
    const phoneQueries = Array.from(
      new Set(
        [trimmedSearch, normalizedPhoneSearch, digitsOnlySearch].filter(
          (value) => value.length >= 2
        )
      )
    );

    orConditions = phoneQueries.flatMap((value) => [
      { serial: { contains: value } },
      { office_phone: { contains: value } },
      { mobile_phone: { contains: value } },
    ]);
  } else {
    const nameParts = trimmedSearch.split(/\s+/).filter(Boolean);

    orConditions = [
      { serial: { contains: trimmedSearch } },
      { first_name: { contains: trimmedSearch } },
      { last_name: { contains: trimmedSearch } },
      ...(nameParts.length > 1
        ? [
            {
              AND: nameParts.map((part) => ({
                OR: [
                  { first_name: { contains: part } },
                  { last_name: { contains: part } },
                ],
              })),
            },
          ]
        : []),
    ];
  }

  return runWithOrganizationContext(organizationId, async () => {
    const contacts = await prismadb.crm_Contacts.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
        OR: orConditions,
      },
      select: {
        id: true,
        serial: true,
        first_name: true,
        last_name: true,
        email: true,
      },
      take,
      orderBy: {
        last_name: "asc",
      },
    });

    return contacts;
  });
};
