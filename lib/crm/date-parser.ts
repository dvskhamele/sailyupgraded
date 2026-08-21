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

  // ── Excel numeric string (e.g. "46189" or "46189.1743") ────────
  if (/^\d{4,6}(?:\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (num > 1000 && num < 100000) {
      const serialDate = excelSerialToDate(num);
      if (serialDate) return serialDate;
    }
  }

  // ── ISO: YYYY-MM-DD (optional time portion and AM/PM) ───────────
  const isoMatch = trimmed.match(
    /^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i,
  );
  if (isoMatch) {
    const [, y, mo, d, hStr, miStr, sStr, meridiem] = isoMatch;
    let h = hStr ? Number(hStr) : 0;
    const mi = miStr ? Number(miStr) : 0;
    const s = sStr ? Number(sStr) : 0;
    if (meridiem) {
      const mUpper = meridiem.toUpperCase();
      if (mUpper === "PM" && h < 12) h += 12;
      if (mUpper === "AM" && h === 12) h = 0;
    }
    const date = new Date(Number(y), Number(mo) - 1, Number(d), h, mi, s);
    if (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === Number(y) &&
      date.getMonth() === Number(mo) - 1 &&
      date.getDate() === Number(d)
    ) {
      return date;
    }
  }

  // ── US formats: MM/DD/YYYY or DD/MM/YYYY with optional time and AM/PM ──
  const usMatch = trimmed.match(
    /^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i,
  );
  if (usMatch) {
    const [, p1Str, p2Str, yStr, hStr, miStr, sStr, meridiem] = usMatch;
    const p1 = Number(p1Str);
    const p2 = Number(p2Str);
    const y = Number(yStr);
    let h = hStr ? Number(hStr) : 0;
    const mi = miStr ? Number(miStr) : 0;
    const s = sStr ? Number(sStr) : 0;
    if (meridiem) {
      const mUpper = meridiem.toUpperCase();
      if (mUpper === "PM" && h < 12) h += 12;
      if (mUpper === "AM" && h === 12) h = 0;
    }

    // Default to MM/DD/YYYY unless p1 > 12 (which must be DD/MM/YYYY)
    let mo = p1;
    let d = p2;
    if (p1 > 12 && p2 <= 12) {
      d = p1;
      mo = p2;
    }

    const date = new Date(y, mo - 1, d, h, mi, s);
    if (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === y &&
      date.getMonth() === mo - 1 &&
      date.getDate() === d
    ) {
      return date;
    }
  }

  // ── Last resort: native Date ─────────────────────────────────────
  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime()) && fallback.getFullYear() >= 1800 && fallback.getFullYear() <= 2200) {
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
