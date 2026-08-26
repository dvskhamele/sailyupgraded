"use server";

import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import type { Prisma } from "@prisma/client";
import { serializeDecimalsList } from "@/lib/serialize-decimals";

export type LeadSearchItem = {
  id: string;
  serial: string | null;
  firstName: string;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  jobTitle?: string | null;
};

interface SearchLeadsParams {
  search: string;
  take?: number;
}

export const searchLeads = async ({
  search,
  take = 10,
}: SearchLeadsParams): Promise<LeadSearchItem[]> => {
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

  let orConditions: Prisma.crm_LeadsWhereInput[] = [];

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
      { phone: { contains: value } },
      { office_phone: { contains: value } },
      { mobile_phone: { contains: value } },
    ]);
  } else {
    const nameParts = trimmedSearch.split(/\s+/).filter(Boolean);

    orConditions = [
      { serial: { contains: trimmedSearch } },
      { firstName: { contains: trimmedSearch } },
      { lastName: { contains: trimmedSearch } },
      { company: { contains: trimmedSearch } },
      { email: { contains: trimmedSearch } },
      { phone: { contains: trimmedSearch } },
      { jobTitle: { contains: trimmedSearch } },
      { description: { contains: trimmedSearch } },
      ...(nameParts.length > 1
        ? [
            {
              AND: nameParts.map((part) => ({
                OR: [
                  { firstName: { contains: part } },
                  { lastName: { contains: part } },
                  { company: { contains: part } },
                ],
              })),
            },
          ]
        : []),
    ];
  }

  const leads = await prismadb.crm_Leads.findMany({
    where: {
      deletedAt: null,
      OR: orConditions,
    },
    select: {
      id: true,
      serial: true,
      firstName: true,
      lastName: true,
      company: true,
      email: true,
      phone: true,
      jobTitle: true,
    },
    take,
    orderBy: {
      createdAt: "desc",
    },
  });

  return serializeDecimalsList(leads);
};
