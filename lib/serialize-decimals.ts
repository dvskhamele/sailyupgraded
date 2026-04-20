/**
 * Convert Prisma Decimal fields to plain numbers for passing to Client Components.
 * Decimal objects are not serializable across the server/client boundary.
 */
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (
    typeof obj === "object" &&
    "toNumber" in (obj as object) &&
    typeof (obj as { toNumber?: unknown }).toNumber === "function"
  ) {
    return (obj as unknown as { toNumber: () => number }).toNumber() as T;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeDecimals(item)) as T;
  }

  if (typeof obj !== "object") return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = serializeDecimals(value);
  }

  return result as T;
}

export function serializeDecimalsList<T>(list: T[]): T[] {
  return list.map(serializeDecimals);
}
