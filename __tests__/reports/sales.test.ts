jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Opportunities: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    exchangeRate: {
      findMany: jest.fn(),
    },
  },
}));

import { prismadb } from "@/lib/prisma";
import {
  BOUND_REVENUE_STAGE_NAME,
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
import type { ReportFilters } from "@/actions/reports/types";

const baseFilters: ReportFilters = {
  dateFrom: new Date("2025-01-01"),
  dateTo: new Date("2025-12-31"),
};

const assignedFilters: ReportFilters = {
  ...baseFilters,
  assigneeId: "user-1",
};

const baseDateWhere = {
  created_on: { gte: baseFilters.dateFrom, lte: baseFilters.dateTo },
  deletedAt: null,
};

const boundRevenueWhere = {
  ...baseDateWhere,
  assigned_sales_stage: {
    is: {
      name: BOUND_REVENUE_STAGE_NAME,
    },
  },
};

const mockRates = [
  { fromCurrency: "EUR", toCurrency: "USD", rate: { toString: () => "1.084" } },
  { fromCurrency: "USD", toCurrency: "EUR", rate: { toString: () => "0.92251" } },
];

describe("sales report actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prismadb.exchangeRate.findMany as jest.Mock).mockResolvedValue(mockRates);
  });

  describe("getRevenue", () => {
    it("sums budget of bound opportunities in date range", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { budget: 100000, currency: "EUR" },
        { budget: 50000, currency: "EUR" },
      ]);
      const result = await getRevenue(baseFilters, "EUR");
      expect(result).toBe(150000);
      expect(prismadb.crm_Opportunities.findMany).toHaveBeenCalledWith({
        where: boundRevenueWhere,
        select: { budget: true, currency: true },
      });
    });

    it("filters bound revenue by assigned member", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { budget: 100000, currency: "EUR" },
      ]);
      const result = await getRevenue(assignedFilters, "EUR");
      expect(result).toBe(100000);
      expect(prismadb.crm_Opportunities.findMany).toHaveBeenCalledWith({
        where: {
          ...boundRevenueWhere,
          assigned_to: "user-1",
        },
        select: { budget: true, currency: true },
      });
    });

    it("returns 0 when no bound opportunities", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([]);
      const result = await getRevenue(baseFilters, "EUR");
      expect(result).toBe(0);
    });
  });

  describe("getPipelineValue", () => {
    it("sums budget of active opportunities", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { budget: 300000, currency: "EUR" },
        { budget: 200000, currency: "EUR" },
      ]);
      const result = await getPipelineValue(baseFilters, "EUR");
      expect(result).toBe(500000);
      expect(prismadb.crm_Opportunities.findMany).toHaveBeenCalledWith({
        where: { ...baseDateWhere, status: "ACTIVE" },
        select: { budget: true, currency: true },
      });
    });
  });

  describe("getOppsByStage", () => {
    it("groups opportunities by sales stage name", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { assigned_sales_stage: { name: "Prospecting" } },
        { assigned_sales_stage: { name: "Prospecting" } },
        { assigned_sales_stage: { name: "Closed Won" } },
      ]);
      const result = await getOppsByStage(baseFilters);
      expect(result).toEqual([
        { name: "Prospecting", Number: 2 },
        { name: "Closed Won", Number: 1 },
      ]);
    });
  });

  describe("getOppsByMonth", () => {
    it("groups opportunities by creation month", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { created_on: new Date("2025-01-15") },
        { created_on: new Date("2025-01-20") },
        { created_on: new Date("2025-02-10") },
      ]);
      const result = await getOppsByMonth(baseFilters);
      expect(result).toEqual([
        { name: "2025-01", Number: 2 },
        { name: "2025-02", Number: 1 },
      ]);
    });
  });

  describe("getWinLossRate", () => {
    it("calculates win/loss counts", async () => {
      (prismadb.crm_Opportunities.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      const result = await getWinLossRate(baseFilters);
      expect(result).toEqual({ won: 10, total: 5, rate: 200 });
    });
  });

  describe("getAvgDealSize", () => {
    it("returns average budget of bound opportunities", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { budget: 50000, currency: "EUR" },
        { budget: 100000, currency: "EUR" },
      ]);
      const result = await getAvgDealSize(baseFilters, "EUR");
      expect(result).toBe(75000);
    });
  });

  describe("getSalesCycleLength", () => {
    it("averages days from creation to close for bound opportunities", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { created_on: new Date("2025-01-01"), close_date: new Date("2025-01-11") },
        { created_on: new Date("2025-02-01"), close_date: new Date("2025-02-21") },
      ]);
      const result = await getSalesCycleLength(baseFilters);
      expect(result).toBe(15);
      expect(prismadb.crm_Opportunities.findMany).toHaveBeenCalledWith({
        where: {
          ...boundRevenueWhere,
          close_date: { not: null },
        },
        select: { created_on: true, close_date: true },
      });
    });
  });

  describe("getRevenueByAssignedMember", () => {
    it("groups bound revenue by assigned member and sorts descending", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        {
          budget: 100000,
          currency: "EUR",
          assigned_to: "user-1",
          assigned_to_user: { name: "Alice" },
        },
        {
          budget: 50000,
          currency: "EUR",
          assigned_to: "user-2",
          assigned_to_user: { name: "Bob" },
        },
        {
          budget: 75000,
          currency: "EUR",
          assigned_to: "user-1",
          assigned_to_user: { name: "Alice" },
        },
      ]);

      const result = await getRevenueByAssignedMember(baseFilters, "EUR");

      expect(result).toEqual([
        { name: "Alice", Number: 175000 },
        { name: "Bob", Number: 50000 },
      ]);
      expect(prismadb.crm_Opportunities.findMany).toHaveBeenCalledWith({
        where: boundRevenueWhere,
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
    });
  });

  describe("getSalesAssignedMemberOptions", () => {
    it("returns unique assigned member options sorted by label", async () => {
      (prismadb.crm_Opportunities.findMany as jest.Mock).mockResolvedValue([
        { assigned_to: "user-2", assigned_to_user: { name: "Bob" } },
        { assigned_to: "user-1", assigned_to_user: { name: "Alice" } },
        { assigned_to: "user-1", assigned_to_user: { name: "Alice" } },
        { assigned_to: "", assigned_to_user: null },
      ]);

      const result = await getSalesAssignedMemberOptions(baseFilters);

      expect(result).toEqual([
        { value: "user-1", label: "Alice" },
        { value: "user-2", label: "Bob" },
      ]);
      expect(prismadb.crm_Opportunities.findMany).toHaveBeenCalledWith({
        where: baseDateWhere,
        select: {
          assigned_to: true,
          assigned_to_user: {
            select: {
              name: true,
            },
          },
        },
      });
    });
  });
});
