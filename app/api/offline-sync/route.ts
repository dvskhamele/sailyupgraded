import { NextResponse } from "next/server";

import { createAccount } from "@/actions/crm/accounts/create-account";
import { updateAccount } from "@/actions/crm/accounts/update-account";
import { createContact } from "@/actions/crm/contacts/create-contact";
import { updateContact } from "@/actions/crm/contacts/update-contact";
import { createLead } from "@/actions/crm/leads/create-lead";
import { updateLead } from "@/actions/crm/leads/update-lead";
import { createOpportunity } from "@/actions/crm/opportunities/create-opportunity";
import { updateOpportunity } from "@/actions/crm/opportunities/update-opportunity";
import type { OfflineSyncEntity, OfflineSyncOperation } from "@/lib/offline-sync/types";

type OfflineSyncRequest = {
  entity: OfflineSyncEntity;
  operation: OfflineSyncOperation;
  payload: Record<string, unknown>;
};

function normalizeOpportunityPayload(payload: Record<string, unknown>) {
  return {
    ...payload,
    close_date:
      typeof payload.close_date === "string" && payload.close_date
        ? new Date(payload.close_date)
        : payload.close_date,
  };
}

const handlers: Record<
  OfflineSyncEntity,
  Record<OfflineSyncOperation, (payload: Record<string, unknown>) => Promise<{ error?: string; data?: unknown } | undefined>>
> = {
  account: {
    create: (payload) => createAccount(payload as Parameters<typeof createAccount>[0]),
    update: (payload) => updateAccount(payload as Parameters<typeof updateAccount>[0]),
  },
  contact: {
    create: (payload) => createContact(payload as Parameters<typeof createContact>[0]),
    update: (payload) => updateContact(payload as Parameters<typeof updateContact>[0]),
  },
  lead: {
    create: (payload) => createLead(payload as Parameters<typeof createLead>[0]),
    update: (payload) => updateLead(payload as Parameters<typeof updateLead>[0]),
  },
  opportunity: {
    create: (payload) =>
      createOpportunity(normalizeOpportunityPayload(payload) as Parameters<typeof createOpportunity>[0]),
    update: (payload) =>
      updateOpportunity(normalizeOpportunityPayload(payload) as Parameters<typeof updateOpportunity>[0]),
  },
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OfflineSyncRequest;
    const entityHandlers = handlers[body.entity];
    const handler = entityHandlers?.[body.operation];

    if (!handler) {
      return NextResponse.json({ error: "Unsupported offline sync mutation." }, { status: 400 });
    }

    const result = await handler(body.payload);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result?.data ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Offline sync failed." },
      { status: 500 }
    );
  }
}
