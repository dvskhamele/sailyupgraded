"use server";

import { prismadb } from "@/lib/prisma";
import {
  appendSocialLeadSourceOptions,
  ensureDefaultContactTypes,
} from "@/lib/crm/contact-form-options";

export const getContactFormOptions = async () => {
  const [accounts, contactTypes, leadSources, leadStatuses, leadTypes, products] = await Promise.all([
    prismadb.crm_Accounts.findMany({ 
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    ensureDefaultContactTypes(),
    prismadb.crm_Lead_Sources.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prismadb.crm_Lead_Statuses.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prismadb.crm_Lead_Types.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prismadb.crm_Products.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    accounts,
    contactTypes,
    leadSources: appendSocialLeadSourceOptions(leadSources),
    leadStatuses,
    leadTypes,
    products,
  };
};
