import { Decimal } from "@prisma/client/runtime/client";
import { isPrismaAccessDeniedError, isTransientPrismaConnectionError, prismadb } from "@/lib/prisma";

import { requireOrganizationId } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";
// Re-export pure functions so existing server-side imports still work
export { findRate, convertAmount, formatCurrency } from "@/lib/currency-format";
export type { Rate } from "@/lib/currency-format";
export {
  formatCurrencyAmount,
  formatCurrencyDisplay,
  formatCurrencyInputValue,
  normalizeCurrencyInput,
  parseCurrencyInput,
  parseCurrencyToDecimalString,
} from "@/lib/currency-input";

const FALLBACK_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "USD" },
  { code: "EUR", name: "Euro", symbol: "EUR" },
  { code: "INR", name: "Indian Rupee", symbol: "INR" },
];

function shouldUseCurrencyFallback(error: unknown) {
  return (
    process.env.BYPASS_LOGIN === "true" ||
    process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true" ||
    isPrismaAccessDeniedError(error) ||
    isTransientPrismaConnectionError(error)
  );
}

function warnCurrencyFallback(operation: string, error: unknown) {
  console.warn(
    `[Currency] ${operation} failed; using local fallback currencies.`,
    error instanceof Error ? error.message : error
  );
}

export async function getExchangeRates() {
  try {
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
  } catch (error) {
    if (!shouldUseCurrencyFallback(error)) {
      throw error;
    }

    warnCurrencyFallback("getExchangeRates", error);
    return [];
  }
}

export async function getSnapshotRate(
  from: string,
  to: string
): Promise<Decimal | null> {
  if (from === to) return new Decimal("1");
  try {
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
  } catch (error) {
    if (!shouldUseCurrencyFallback(error)) {
      throw error;
    }

    warnCurrencyFallback("getSnapshotRate", error);
    return null;
  }
}

export async function getDefaultCurrency(): Promise<string> {
  const organizationId = await requireOrganizationId();

  return runWithOrganizationContext(organizationId, async () => {
    try {
      const setting = await prismadb.crm_SystemSettings.findUnique({
        where: { key: "default_currency", organizationId },
      });
      return setting?.value || "USD";
    } catch (error) {
      if (!shouldUseCurrencyFallback(error)) {
        throw error;
      }

      warnCurrencyFallback("getDefaultCurrency", error);
      return "USD";
    }
  });
}

export async function getEnabledCurrencies() {
  try {
    return await prismadb.currency.findMany({
      where: { isEnabled: true },
      orderBy: { code: "asc" },
    });
  } catch (error) {
    if (!shouldUseCurrencyFallback(error)) {
      throw error;
    }

    warnCurrencyFallback("getEnabledCurrencies", error);
    return FALLBACK_CURRENCIES;
  }
}
