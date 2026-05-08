"use server";

import { getDefaultCurrency } from "@/lib/currency";
import { prismadb } from "@/lib/prisma";
import type { QuickDbMemory, QuickMemoryField } from "@/lib/crm/quick-input-engine";

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
  return items.find((item) => normalized.includes(item.name.toLowerCase()))?.id ?? items[0]?.id ?? "";
}

export async function getQuickInputMemory(): Promise<QuickDbMemory> {
  const [contacts, opportunities, leadSources, stages, types, defaultCurrency] = await Promise.all([
    prismadb.crm_Contacts.findMany({
      where: { deletedAt: null },
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
      where: { deletedAt: null },
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
    getDefaultCurrency(),
  ]);

  const names = contacts.map((contact) =>
    [contact.first_name, contact.last_name].filter(Boolean).join(" "),
  );
  const dealValues = compact(opportunities.map((opportunity) => opportunity.budget?.toString()), 5);
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
    ...fields,
    defaultCurrency,
    defaultSalesStageId: pickByName(stages, ["New Lead Intake", "New", "Lead", "Prospecting"]),
    defaultOpportunityTypeId: pickByName(types, ["Inbound", "New Business", "New"]),
    defaultBudget: dealValues[0] ?? "1000",
  };
}
