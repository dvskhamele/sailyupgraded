import { prismadb } from "@/lib/prisma";
import type { ReportFilters, ChartDataPoint } from "./types";
import { groupedToChartData } from "./types";
import { getExchangeRates, convertAmount } from "@/lib/currency";
import { Decimal } from "@prisma/client/runtime/client";

function dateRangeWhere(filters: ReportFilters) {
  return {
    created_on: { gte: filters.dateFrom, lte: filters.dateTo },
    deletedAt: null,
  };
}

function assigneeWhere(filters: ReportFilters) {
  return filters.assigneeId ? { assigned_to: filters.assigneeId } : {};
}

function boundRevenueWhere(filters: ReportFilters) {
  return {
    ...dateRangeWhere(filters),
    ...assigneeWhere(filters),
    assigned_sales_stage: {
      is: {
        countInRevenue: true,
      },
    },
  };
}

type RevenueOpportunity = {
  budget: unknown;
  currency: string | null;
};

function sumConvertedRevenue(
  opportunities: RevenueOpportunity[],
  displayCurrency: string,
  rates: Awaited<ReturnType<typeof getExchangeRates>>
) {
  let total = new Decimal(0);

  for (const opportunity of opportunities) {
    const budget = new Decimal(opportunity.budget?.toString() ?? "0");
    const from = opportunity.currency || displayCurrency;
    const converted = convertAmount(budget, from, displayCurrency, rates);
    total = total.add(converted ?? budget);
  }

  return total;
}

export async function getRevenue(filters: ReportFilters, displayCurrency: string): Promise<number> {
  const opps = await prismadb.crm_Opportunities.findMany({
    where: boundRevenueWhere(filters),
    select: { budget: true, currency: true },
  });
  const rates = await getExchangeRates();
  return sumConvertedRevenue(opps, displayCurrency, rates).toNumber();
}

export async function getPipelineValue(filters: ReportFilters, displayCurrency: string): Promise<number> {
  const opps = await prismadb.crm_Opportunities.findMany({
    where: { 
      ...dateRangeWhere(filters), 
      ...assigneeWhere(filters), 
      assigned_sales_stage: { is: { countInPipeline: true } } 
    },
    select: { budget: true, currency: true },
  });
  const rates = await getExchangeRates();
  return sumConvertedRevenue(opps, displayCurrency, rates).toNumber();
}

export async function getOppsByStage(filters: ReportFilters): Promise<ChartDataPoint[]> {
  const opps = await prismadb.crm_Opportunities.findMany({
    where: { ...dateRangeWhere(filters), ...assigneeWhere(filters) },
    select: { assigned_sales_stage: { select: { name: true } } },
  });
  const grouped: Record<string, number> = {};
  for (const opp of opps) {
    const stage = opp.assigned_sales_stage?.name ?? "Unassigned";
    grouped[stage] = (grouped[stage] || 0) + 1;
  }
  return groupedToChartData(grouped);
}

export async function getOppsByMonth(filters: ReportFilters): Promise<ChartDataPoint[]> {
  const opps = await prismadb.crm_Opportunities.findMany({
    where: { ...dateRangeWhere(filters), ...assigneeWhere(filters) },
    select: { created_on: true },
  });
  const grouped: Record<string, number> = {};
  for (const opp of opps) {
    if (!opp.created_on) continue;
    const d = new Date(opp.created_on);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    grouped[key] = (grouped[key] || 0) + 1;
  }
  return groupedToChartData(grouped, true);
}

export async function getWinLossRate(
  filters: ReportFilters
): Promise<{ won: number; total: number; rate: number }> {
  const won = await prismadb.crm_Opportunities.count({
    where: { ...dateRangeWhere(filters), ...assigneeWhere(filters), status: "CLOSED" },
  });
  const total = await prismadb.crm_Opportunities.count({
    where: { ...dateRangeWhere(filters), ...assigneeWhere(filters), status: { in: ["CLOSED", "INACTIVE"] } },
  });
  return { won, total, rate: total > 0 ? Math.round((won / total) * 100) : 0 };
}

export async function getAvgDealSize(filters: ReportFilters, displayCurrency: string): Promise<number> {
  const opps = await prismadb.crm_Opportunities.findMany({
    where: boundRevenueWhere(filters),
    select: { budget: true, currency: true },
  });
  if (opps.length === 0) return 0;
  const rates = await getExchangeRates();
  const total = sumConvertedRevenue(opps, displayCurrency, rates);
  return total.div(opps.length).toDecimalPlaces(2).toNumber();
}

export async function getSalesCycleLength(filters: ReportFilters): Promise<number> {
  const opps = await prismadb.crm_Opportunities.findMany({
    where: { ...boundRevenueWhere(filters), close_date: { not: null } },
    select: { created_on: true, close_date: true },
  });
  if (opps.length === 0) return 0;
  let totalDays = 0;
  for (const opp of opps) {
    if (!opp.created_on || !opp.close_date) continue;
    const diff = opp.close_date.getTime() - opp.created_on.getTime();
    totalDays += diff / (1000 * 60 * 60 * 24);
  }
  return Math.round(totalDays / opps.length);
}

export async function getRevenueByAssignedMember(
  filters: ReportFilters,
  displayCurrency: string
): Promise<ChartDataPoint[]> {
  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: boundRevenueWhere(filters),
    select: {
      budget: true,
      currency: true,
      assigned_to: true,
      assigned_to_user: {
        select: {
          name: true,
        },
      },
    },
  });
  const rates = await getExchangeRates();
  const grouped = new Map<string, Decimal>();

  for (const opportunity of opportunities) {
    const memberName =
      opportunity.assigned_to_user?.name?.trim() ||
      opportunity.assigned_to ||
      "Unassigned";
    const convertedRevenue = sumConvertedRevenue(
      [opportunity],
      displayCurrency,
      rates
    );

    grouped.set(memberName, (grouped.get(memberName) ?? new Decimal(0)).add(convertedRevenue));
  }

  return Array.from(grouped.entries())
    .map(([name, revenue]) => ({ name, Number: revenue.toNumber() }))
    .sort((first, second) => second.Number - first.Number);
}

export async function getSalesAssignedMemberOptions(filters: ReportFilters) {
  const opportunities = await prismadb.crm_Opportunities.findMany({
    where: dateRangeWhere(filters),
    select: {
      assigned_to: true,
      assigned_to_user: {
        select: {
          name: true,
        },
      },
    },
  });
  const membersById = new Map<string, string>();

  for (const opportunity of opportunities) {
    const memberId = opportunity.assigned_to?.trim();

    if (!memberId || membersById.has(memberId)) {
      continue;
    }

    membersById.set(
      memberId,
      opportunity.assigned_to_user?.name?.trim() || memberId
    );
  }

  return Array.from(membersById.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((first, second) => first.label.localeCompare(second.label));
}
