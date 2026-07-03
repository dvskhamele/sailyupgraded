import { AsyncLocalStorage } from "node:async_hooks";

type OrganizationContext = {
  organizationId: string | null;
};

const organizationContext = new AsyncLocalStorage<OrganizationContext>();

export function getOrganizationContext() {
  return organizationContext.getStore()?.organizationId ?? null;
}

export function requireOrganizationContext() {
  const organizationId = getOrganizationContext();

  if (!organizationId) {
    throw new Error("Organization context is required");
  }

  return organizationId;
}

export function setOrganizationContext(organizationId: string | null) {
  organizationContext.enterWith({ organizationId });
}

export function runWithOrganizationContext<T>(
  organizationId: string | null,
  callback: () => T,
) {
  return organizationContext.run({ organizationId }, callback);
}
