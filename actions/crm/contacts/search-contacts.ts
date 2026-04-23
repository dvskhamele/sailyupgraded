"use server";

import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import type { Prisma } from "@prisma/client";

export type ContactSearchItem = {
  id: string;
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
      { office_phone: { contains: value } },
      { mobile_phone: { contains: value } },
    ]);
  } else {
    const nameParts = trimmedSearch.split(/\s+/).filter(Boolean);

    orConditions = [
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

  const contacts = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
      OR: orConditions,
    },
    select: {
      id: true,
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
};
