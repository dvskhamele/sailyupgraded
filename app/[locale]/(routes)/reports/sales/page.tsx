import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { prismadb } from "@/lib/prisma";
import { getDefaultCurrency, formatCurrency as formatCurrencyUtil } from "@/lib/currency";
import { Decimal } from "@prisma/client/runtime/client";
import { Card, CardContent } from "@/components/ui/card";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { parseSearchParamsToFilters } from "@/actions/reports/types";
import {
  getRevenue,
  getPipelineValue,
  getOppsByStage,
  getOppsByMonth,
  getWinLossRate,
  getAvgDealSize,
  getSalesCycleLength,
  getRevenueByAssignedMember,
  getSalesAssignedMemberOptions,
} from "@/actions/reports/sales";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SalesReportPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const params = new URLSearchParams(
    Object.entries(resolvedParams).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );
  const filters = parseSearchParamsToFilters(params);
  const t = await getTranslations("ReportsPage");

  const cookieStore = await cookies();
  const defaultCurrency = await getDefaultCurrency();
  const displayCurrency = cookieStore.get("display_currency")?.value || defaultCurrency;

  const [
    revenue,
    pipeline,
    oppsByStage,
    oppsByMonth,
    winLoss,
    avgDeal,
    cycleLength,
    revenueByAssignedMember,
    assignedMemberOptions,
  ] =
    await Promise.all([
      getRevenue(filters, displayCurrency),
      getPipelineValue(filters, displayCurrency),
      getOppsByStage(filters),
      getOppsByMonth(filters),
      getWinLossRate(filters),
      getAvgDealSize(filters, displayCurrency),
      getSalesCycleLength(filters),
      getRevenueByAssignedMember(filters, displayCurrency),
      getSalesAssignedMemberOptions(filters),
    ]);

  const revenueStages = await prismadb.crm_Opportunities_Sales_Stages.findMany({
    where: { countInRevenue: true },
    select: { name: true },
    orderBy: { order: "asc" },
  });

  const pipelineStages = await prismadb.crm_Opportunities_Sales_Stages.findMany({
    where: { countInPipeline: true },
    select: { name: true },
    orderBy: { order: "asc" },
  });

  return (
    <ReportPageLayout
      title={t("sales.title")}
      description={t("sales.description")}
      category="sales"
      helpModule="reports"
      currentFilters={params.toString()}
      filterOptions={[
        {
          key: "assigneeId",
          labelKey: "assignedMember",
          options: assignedMemberOptions,
        },
      ]}
    >
      <div className="mb-6 flex flex-col gap-2 rounded-lg border bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          Revenue Calculation Basis
        </div>
        <p className="text-xs text-emerald-700/80">
          Revenue is calculated from stages marked as <strong>&quot;Include in Revenue&quot;</strong>. 
          Pipeline value is calculated from stages marked as <strong>&quot;Include in Pipeline&quot;</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          {revenueStages.length > 0 ? (
            revenueStages.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-emerald-600 border border-emerald-100 shadow-sm" title="Revenue Stage">
                {s.name}
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">No stages currently marked for revenue.</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 border-t pt-2 border-emerald-100/50">
          {pipelineStages.length > 0 ? (
            pipelineStages.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-blue-600 border border-blue-100 shadow-sm" title="Pipeline Stage">
                {s.name}
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">No stages currently marked for pipeline.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("sales.revenue")}</p>
          <p className="text-2xl font-bold mt-1">{formatCurrencyUtil(new Decimal(revenue), displayCurrency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("sales.pipeline")}</p>
          <p className="text-2xl font-bold mt-1">{formatCurrencyUtil(new Decimal(pipeline), displayCurrency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("sales.avgDeal")}</p>
          <p className="text-2xl font-bold mt-1">{formatCurrencyUtil(new Decimal(avgDeal), displayCurrency)}</p>
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("sales.winRate")}</p>
          <p className="text-2xl font-bold mt-1">{winLoss.rate}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{t("sales.cycleLength")}</p>
          <p className="text-2xl font-bold mt-1">{cycleLength} {t("sales.days")}</p>
        </CardContent></Card>
      </div>
      <ReportChart
        data={revenueByAssignedMember}
        titleKey="revenueByAssignedMember"
        type="bar"
        layout="horizontal"
      />
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("sales.revenueByAssignedMember")}</p>
            <p className="text-xs text-muted-foreground">
              Calculated from revenue-marked stages only
            </p>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("sales.assignedMember")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("sales.revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {revenueByAssignedMember.length > 0 ? (
                  revenueByAssignedMember.map((row) => (
                    <tr key={row.name} className="border-t">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrencyUtil(new Decimal(row.Number), displayCurrency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {t("charts.noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <ReportChart data={oppsByStage} titleKey="oppsByStage" type="bar" />
      <ReportChart data={oppsByMonth} titleKey="oppsByMonth" type="area" />
    </ReportPageLayout>
  );
}
