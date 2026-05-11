"use server";

import { getAccountIndustries } from "@/lib/crm/industries";

export const getIndustries = async () => {
  return getAccountIndustries();
};
