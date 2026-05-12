export function normalizeOptions(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

export function normalizeAppliesTo(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeContactRoleScope(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return ["Agent", "Customer", "Client", "Partner", "Vendor", "Other"].includes(normalized)
    ? normalized
    : undefined;
}

export function buildAppliesToScopes(appliesTo: string[], contactRole?: string) {
  return appliesTo.map((entity) =>
    entity === "Contact" && contactRole ? `Contact:${contactRole}` : entity,
  );
}
