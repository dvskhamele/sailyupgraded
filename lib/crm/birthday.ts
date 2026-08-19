import { format } from "date-fns";

/**
 * Robust birthday parser that handles multiple input formats without timezone shifts:
 * - Date instances (uses local calendar year/month/day)
 * - ISO string: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss.sssZ"
 * - CRM string formats: "DD/MM/YYYY", "D/M/YYYY", "DD-MM-YYYY"
 * - Standard string formats: "YYYY/MM/DD", "YYYY.MM.DD"
 * - US format fallback: "MM/DD/YYYY" (when first part > 12 or second part <= 12)
 * - Objects with { birthday_year, birthday_month, birthday_day } or { year, month, day }
 *
 * Returns a valid local Date representing the birthday, or null if invalid/empty.
 */
export function parseBirthday(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // Native Date instance
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    const year = value.getFullYear();
    const month = value.getMonth();
    const day = value.getDate();
    if (year >= 1800) {
      return new Date(year, month, day);
    }
    return null;
  }

  // Object with birthday parts
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const yStr = obj.birthday_year ?? obj.year;
    const mStr = obj.birthday_month ?? obj.month;
    const dStr = obj.birthday_day ?? obj.day;

    if (yStr !== undefined && mStr !== undefined && dStr !== undefined && yStr !== "" && mStr !== "" && dStr !== "") {
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);

      if (
        !Number.isNaN(y) &&
        !Number.isNaN(m) &&
        !Number.isNaN(d) &&
        y >= 1800 &&
        m >= 1 &&
        m <= 12 &&
        d >= 1 &&
        d <= 31
      ) {
        const localDate = new Date(y, m - 1, d);
        if (
          localDate.getFullYear() === y &&
          localDate.getMonth() === m - 1 &&
          localDate.getDate() === d
        ) {
          return localDate;
        }
      }
      return null;
    }

    if ("birthday" in obj && obj.birthday) {
      return parseBirthday(obj.birthday);
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const localDate = new Date(year, month, day);
    if (
      localDate.getFullYear() === year &&
      localDate.getMonth() === month &&
      localDate.getDate() === day
    ) {
      return localDate;
    }
    return null;
  }

  // 2. Day/Month/Year or Month/Day/Year: DD/MM/YYYY or DD-MM-YYYY
  const partsMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (partsMatch) {
    const p1 = parseInt(partsMatch[1], 10);
    const p2 = parseInt(partsMatch[2], 10);
    const year = parseInt(partsMatch[3], 10);

    // Primary: DD/MM/YYYY (CRM standard)
    if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
      const localDate = new Date(year, p2 - 1, p1);
      if (
        localDate.getFullYear() === year &&
        localDate.getMonth() === p2 - 1 &&
        localDate.getDate() === p1
      ) {
        return localDate;
      }
    }

    // Secondary fallback: MM/DD/YYYY (if p1 was month and p2 was day)
    if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
      const localDate = new Date(year, p1 - 1, p2);
      if (
        localDate.getFullYear() === year &&
        localDate.getMonth() === p1 - 1 &&
        localDate.getDate() === p2
      ) {
        return localDate;
      }
    }

    return null;
  }

  // 3. Fallback to native Date parser for other non-numeric date strings (e.g. "May 15, 1990")
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth();
    const d = parsed.getDate();
    if (y >= 1800) {
      return new Date(y, m, d);
    }
  }

  return null;
}

/**
 * Format a birthday value as DD/MM/YYYY. Returns empty string if invalid or not set.
 */
export function formatBirthday(
  value: unknown,
  formatStr: string = "dd/MM/yyyy"
): string {
  const date = parseBirthday(value);
  if (!date) return "";
  try {
    return format(date, formatStr);
  } catch {
    return "";
  }
}

/**
 * Format birthday for clean UI display (DD/MM/YYYY).
 */
export function formatBirthdayDisplay(value: unknown): string {
  return formatBirthday(value, "dd/MM/yyyy");
}

/**
 * Extract birthday parts ({ birthday_year, birthday_month, birthday_day }) as strings.
 */
export function birthdayToParts(value: unknown): {
  birthday_year: string;
  birthday_month: string;
  birthday_day: string;
} {
  const date = parseBirthday(value);
  if (!date) {
    return {
      birthday_year: "",
      birthday_month: "",
      birthday_day: "",
    };
  }
  return {
    birthday_year: String(date.getFullYear()),
    birthday_month: String(date.getMonth() + 1),
    birthday_day: String(date.getDate()),
  };
}

/**
 * Format birthday for Contact DB storage (`crm_Contacts.birthday` string column).
 * Standardized as `DD/MM/YYYY`.
 */
export function formatBirthdayForContactDb(value: unknown): string | null {
  const date = parseBirthday(value);
  if (!date) return null;
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Format birthday for Lead DB storage (`crm_Leads.birthday` DateTime column).
 * Uses UTC midnight so Prisma Date storage does not suffer from timezone shifts.
 */
export function formatBirthdayForLeadDb(value: unknown): Date | null {
  const date = parseBirthday(value);
  if (!date) return null;
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  );
}
