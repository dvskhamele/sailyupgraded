import Decimal from "decimal.js";

type Rate = { fromCurrency: string; toCurrency: string; rate: Decimal };

export type { Rate };

export function findRate(
  from: string,
  to: string,
  rates: Rate[]
): Decimal | null {
  if (from === to) return new Decimal("1");
  const direct = rates.find(
    (r) => r.fromCurrency === from && r.toCurrency === to
  );
  return direct ? new Decimal(direct.rate) : null;
}

export function convertAmount(
  amount: Decimal,
  from: string,
  to: string,
  rates: Rate[]
): Decimal | null {
  const rate = findRate(from, to, rates);
  if (!rate) return null;
  return amount.mul(rate).toDecimalPlaces(2);
}

export function formatCurrency(amount: Decimal, currencyCode: string): string {
  const num = amount.toNumber();
  const isWhole = num % 1 === 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(num);
  if (!formatted.includes(currencyCode)) {
    return `${formatted} ${currencyCode}`;
  }
  return formatted;
}
