/**
 * Safe date parser for CRM imports.
 *
 * Handles:
 *   - ISO 8601:  YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss
 *   - US formats: MM/DD/YYYY, MM-DD-YYYY
 *   - Excel Date objects (pass-through)
 *   - Excel serial date numbers (days since 1899-12-30)
 *   - Native Date objects (pass-through)
 *
 * Returns null when the value cannot be resolved to a valid Date.
 */

export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // ── ISO: YYYY-MM-DD (optional time portion) ──────────────────────
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (isoMatch) {
    const [, y, mo, d, h, mi, s] = isoMatch;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      h ? Number(h) : 0,
      mi ? Number(mi) : 0,
      s ? Number(s) : 0,
    );
    if (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === Number(mo) - 1 &&
      date.getDate() === Number(d)
    ) {
      return date;
    }
  }

  // ── US formats: MM/DD/YYYY or MM-DD-YYYY ────────────────────────
  const usMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    const [, mo, d, y] = usMatch;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    if (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === Number(mo) - 1 &&
      date.getDate() === Number(d)
    ) {
      return date;
    }
  }

  // ── Last resort: native Date (ISO strings only) ─────────────────
  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

/**
 * Convert an Excel serial date number to a JS Date.
 *
 * Excel's "1900 date system": serial 1 = 1900-01-01.
 * Internally we treat the epoch as 1899-12-30 so that serial 1 → 1900-01-01.
 * (Excel incorrectly treats 1900 as a leap year; serial 60 = 1900-02-29
 * doesn't exist, but we don't need to handle that edge case here.)
 */
function excelSerialToDate(serial: number): Date | null {
  const MS_PER_DAY = 86_400_000;
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + serial * MS_PER_DAY);
  return Number.isNaN(date.getTime()) ? null : date;
}
