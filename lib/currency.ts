import { Decimal } from "@prisma/client/runtime/client";
import { prismadb } from "@/lib/prisma";

// Re-export pure functions so existing server-side imports still work
export { findRate, convertAmount, formatCurrency } from "@/lib/currency-format";
export type { Rate } from "@/lib/currency-format";

export async function getExchangeRates() {
  const exchangeRateModel = (prismadb as typeof prismadb & {
    exchangeRate?: {
      findMany?: () => Promise<
        Array<{ fromCurrency: string; toCurrency: string; rate: Decimal }>
      >;
    };
  }).exchangeRate;

  if (!exchangeRateModel?.findMany) {
    return [];
  }

  const rates = await exchangeRateModel.findMany();
  return rates.map((r: { fromCurrency: string; toCurrency: string; rate: Decimal }) => ({
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rate: r.rate,
  }));
}

export async function getSnapshotRate(
  from: string,
  to: string
): Promise<Decimal | null> {
  if (from === to) return new Decimal("1");
  const exchangeRateModel = (prismadb as typeof prismadb & {
    exchangeRate?: {
      findUnique?: (args: {
        where: {
          fromCurrency_toCurrency: { fromCurrency: string; toCurrency: string };
        };
      }) => Promise<{ rate: Decimal } | null>;
    };
  }).exchangeRate;

  if (!exchangeRateModel?.findUnique) {
    return null;
  }

  const rate = await exchangeRateModel.findUnique({
    where: {
      fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to },
    },
  });
  return rate ? rate.rate : null;
}

export async function getDefaultCurrency(): Promise<string> {
  const setting = await prismadb.crm_SystemSettings.findUnique({
    where: { key: "default_currency" },
  });
  return setting?.value || "EUR";
}

export async function getEnabledCurrencies() {
  return prismadb.currency.findMany({
    where: { isEnabled: true },
    orderBy: { code: "asc" },
  });
}
