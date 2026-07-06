"use server";

import { getDefaultCurrency } from "@/lib/currency";
import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import type { QuickDbMemory, QuickMemoryField } from "@/lib/crm/quick-input-engine";
import { runWithOrganizationContext, getOrganizationContext } from "@/lib/organization-context";

const bypassLogin =
  process.env.BYPASS_LOGIN === "true" ||
  process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

const fallbackQuickInputMemory: QuickDbMemory = {
  names: [],
  companies: [],
  cities: [],
  dealValues: [],
  sources: [],
  agentNumbers: [],
  emails: [],
  defaultCurrency: "USD",
  defaultSalesStageId: "local-prospecting",
  defaultOpportunityTypeId: "",
  defaultBudget: "1000",
};

function shouldUseFallback(error: unknown) {
  return isPrismaAccessDeniedError(error) || isTransientPrismaConnectionError(error);
}

function compact(values: Array<string | number | null | undefined>, limit = 5) {
  const counts = new Map<string, number>();

  values.forEach((raw) => {
    const value = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function pickByName(items: { id: string; name: string }[], names: string[]) {
  const normalized = names.map((name) => name.toLowerCase());

  return (
    items.find((item) => normalized.includes(item.name.toLowerCase()))?.id ??
    items[0]?.id ??
    ""
  );
}

export async function getQuickInputMemory(): Promise<QuickDbMemory> {
  if (bypassLogin) {
    return fallbackQuickInputMemory;
  }

  const organizationId = await requireOrganizationId();

  return await withPrismaRetry(async () => {
    return await runWithOrganizationContext(organizationId, async () => {
    let contacts;
    let opportunities;
    let leadSources;
    let stages;
    let types;
    let defaultCurrency;

    try {
      const session = await getSession();

      if (!session?.user) {
        return fallbackQuickInputMemory;
      }

      const contactVisibilityFilter = await buildExistingDbContactVisibilityFilter(
        session.user
      );

      console.log("[getQuickInputMemory] async context org id:", getOrganizationContext());
      [contacts, opportunities, leadSources, stages, types] =
        await prismadb.$transaction([
          prismadb.crm_Contacts.findMany({
            where: {
              organizationId,
              deletedAt: null,
              ...contactVisibilityFilter,
            },
            select: {
              first_name: true,
              last_name: true,
              company: true,
              city: true,
              email: true,
              serial: true,
            },
            orderBy: { cratedAt: "desc" },
            take: 150,
          }),

          prismadb.crm_Opportunities.findMany({
            where: { organizationId, deletedAt: null },
            select: { budget: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),

          prismadb.crm_Lead_Sources.findMany({
            select: { name: true },
            orderBy: { name: "asc" },
          }),

          prismadb.crm_Opportunities_Sales_Stages.findMany({
            select: { id: true, name: true },
            orderBy: [{ order: "asc" }, { name: "asc" }],
          }),

          prismadb.crm_Opportunities_Type.findMany({
            select: { id: true, name: true },
            orderBy: [{ order: "asc" }, { name: "asc" }],
          }),
        ]);

      defaultCurrency = await getDefaultCurrency();
    } catch (error) {
      if (!shouldUseFallback(error)) {
        throw error;
      }

      console.warn(
        "[CRM] getQuickInputMemory failed; using local fallback data.",
        error instanceof Error ? error.message : error
      );

      return fallbackQuickInputMemory;
    }

    const names = contacts.map((contact) =>
      [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    );

    const dealValues = compact(
      opportunities.map((opportunity) => opportunity.budget?.toString()),
      5
    );

    const fields: Partial<Record<QuickMemoryField, string[]>> = {
      names: compact(names, 5),
      companies: compact(contacts.map((contact) => contact.company), 5),
      cities: compact(contacts.map((contact) => contact.city), 5),
      dealValues,
      sources: compact(leadSources.map((source) => source.name), 5),
      agentNumbers: compact(contacts.map((contact) => contact.serial), 5),
      emails: compact(contacts.map((contact) => contact.email), 5),
    };

    return {
      ...fallbackQuickInputMemory,
      ...fields,
      defaultCurrency,
      defaultSalesStageId: pickByName(stages, [
        "New Lead Intake",
        "New",
        "Lead",
        "Prospecting",
      ]),
      defaultOpportunityTypeId: pickByName(types, [
        "Inbound",
        "New Business",
        "New",
      ]),
      defaultBudget: dealValues[0] ?? "1000",
    };
    });
  });
}