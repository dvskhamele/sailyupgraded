export function normalizeCurrencyInput(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const unsigned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = unsigned.split(".");
  const decimals = decimalParts.join("").slice(0, 2);
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");

  if (raw.includes(".") && decimals.length === 0) {
    return `${normalizedWhole || "0"}.`;
  }

  return decimals ? `${normalizedWhole || "0"}.${decimals}` : normalizedWhole;
}

export function currencyInputToDecimalString(value: unknown): string | undefined {
  const normalized = normalizeCurrencyInput(value);
  if (!normalized || normalized === ".") return undefined;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return undefined;
  return numeric.toFixed(2);
}

export const parseCurrencyToDecimalString = currencyInputToDecimalString;

export function currencyInputToNumber(value: unknown): number | undefined {
  const decimalString = currencyInputToDecimalString(value);
  if (!decimalString) return undefined;
  const numeric = Number(decimalString);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export const parseCurrencyInput = currencyInputToNumber;

export function formatCurrencyInputValue(value: unknown): string {
  const decimalString = currencyInputToDecimalString(value);
  if (!decimalString) return "";
  const numeric = Number(decimalString);
  const isWhole = numeric % 1 === 0;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatCurrencyDisplay(
  value: unknown,
  currency = "USD",
  fallback = "N/A"
): string {
  const decimalString = currencyInputToDecimalString(value);
  if (!decimalString) return fallback;
  const numeric = Number(decimalString);
  const isWhole = numeric % 1 === 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export const formatCurrencyAmount = formatCurrencyDisplay;
