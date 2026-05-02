import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-log";
import { prismadb } from "@/lib/prisma";

type RawRow = Record<string, string>;
type MappingKey =
  | "external_id"
  | "created_time"
  | "ad_id"
  | "opportunity_name"
  | "adset_id"
  | "adset_name"
  | "campaign_id"
  | "campaign_name"
  | "form_id"
  | "form_name"
  | "is_organic"
  | "platform"
  | "budget"
  | "full_name"
  | "phone_number"
  | "lead_status";
type ColumnMapping = Partial<Record<MappingKey, string>>;

const MAX_ROWS = 500;

function mappedValue(row: RawRow, column?: string) {
  return column ? String(row[column] ?? "").trim() : "";
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/[^\d+]/g, "");
  return normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function parseBudget(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!normalized) return undefined;

  const amount = Number(normalized[0]);
  return Number.isFinite(amount) ? amount : undefined;
}

function buildDescription(data: {
  externalId?: string;
  createdTime?: string;
  adId?: string;
  adsetId?: string;
  adsetName?: string;
  campaignId?: string;
  campaignName?: string;
  formId?: string;
  formName?: string;
  isOrganic?: string;
  platform?: string;
  budget?: string;
  fullName?: string;
  phoneNumber?: string;
  leadStatus?: string;
}) {
  const lines = [
    "Imported from WhatsApp lead",
    data.externalId ? `Lead ID: ${data.externalId}` : null,
    data.createdTime ? `Created time: ${data.createdTime}` : null,
    data.adId ? `Ad ID: ${data.adId}` : null,
    data.adsetId ? `Adset ID: ${data.adsetId}` : null,
    data.adsetName ? `Adset name: ${data.adsetName}` : null,
    data.campaignId ? `Campaign ID: ${data.campaignId}` : null,
    data.campaignName ? `Campaign name: ${data.campaignName}` : null,
    data.formId ? `Form ID: ${data.formId}` : null,
    data.formName ? `Form name: ${data.formName}` : null,
    data.isOrganic ? `Is organic: ${data.isOrganic}` : null,
    data.platform ? `Platform: ${data.platform}` : null,
    data.budget ? `Website development budget: ${data.budget}` : null,
    data.fullName ? `Full name: ${data.fullName}` : null,
    data.phoneNumber ? `Phone number: ${data.phoneNumber}` : null,
    data.leadStatus ? `Lead status: ${data.leadStatus}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? (body.rows as RawRow[]) : [];
  const mapping = (body?.mapping || {}) as ColumnMapping;

  if (!mapping.opportunity_name) {
    return NextResponse.json(
      { error: "ad_name mapping is required" },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows provided for import" },
      { status: 400 },
    );
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Import limited to ${MAX_ROWS} rows per file` },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const failures: Array<{ row: number; name: string | null; reason: string }> = [];
  let imported = 0;

  const uniqueCampaignNames = Array.from(
    new Set(
      rows
        .map((row) => mappedValue(row, mapping.campaign_name))
        .filter(Boolean),
    ),
  );

  const campaigns = uniqueCampaignNames.length
    ? await prismadb.crm_campaigns.findMany({
        where: {
          deletedAt: null,
          name: { in: uniqueCampaignNames },
        },
        select: { id: true, name: true },
      })
    : [];

  const campaignLookup = new Map(campaigns.map((campaign) => [campaign.name, campaign.id]));

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const opportunityName = mappedValue(row, mapping.opportunity_name);

    if (!opportunityName) {
      failures.push({
        row: rowNumber,
        name: null,
        reason: "Skipped because ad_name is empty",
      });
      continue;
    }

    const createdTime = mappedValue(row, mapping.created_time);
    const adId = mappedValue(row, mapping.ad_id);
    const adsetId = mappedValue(row, mapping.adset_id);
    const adsetName = mappedValue(row, mapping.adset_name);
    const campaignId = mappedValue(row, mapping.campaign_id);
    const campaignName = mappedValue(row, mapping.campaign_name);
    const formId = mappedValue(row, mapping.form_id);
    const formName = mappedValue(row, mapping.form_name);
    const isOrganic = mappedValue(row, mapping.is_organic);
    const platform = mappedValue(row, mapping.platform);
    const budgetRaw = mappedValue(row, mapping.budget);
    const fullName = mappedValue(row, mapping.full_name);
    const phoneNumber = normalizePhone(mappedValue(row, mapping.phone_number));
    const leadStatus = mappedValue(row, mapping.lead_status);
    const externalId = mappedValue(row, mapping.external_id);

    const parsedCreatedTime = parseDate(createdTime);
    const parsedBudget = parseBudget(budgetRaw);
    const matchedCampaignId = campaignName ? campaignLookup.get(campaignName) : undefined;

    try {
      await prismadb.crm_Opportunities.create({
        data: {
          assigned_to_user: { connect: { id: userId } },
          assigned_campaings: matchedCampaignId
            ? { connect: { id: matchedCampaignId } }
            : undefined,
          budget: parsedBudget,
          clientName: normalizeOptionalText(fullName) || null,
          created_by_user: { connect: { id: userId } },
          created_on: parsedCreatedTime,
          createdAt: parsedCreatedTime,
          description: buildDescription({
            externalId: normalizeOptionalText(externalId),
            createdTime: normalizeOptionalText(createdTime),
            adId: normalizeOptionalText(adId),
            adsetId: normalizeOptionalText(adsetId),
            adsetName: normalizeOptionalText(adsetName),
            campaignId: normalizeOptionalText(campaignId),
            campaignName: normalizeOptionalText(campaignName),
            formId: normalizeOptionalText(formId),
            formName: normalizeOptionalText(formName),
            isOrganic: normalizeOptionalText(isOrganic),
            platform: normalizeOptionalText(platform),
            budget: normalizeOptionalText(budgetRaw),
            fullName: normalizeOptionalText(fullName),
            phoneNumber: normalizeOptionalText(phoneNumber),
            leadStatus: normalizeOptionalText(leadStatus),
          }),
          last_activity_by: userId,
          name: opportunityName,
          next_step: normalizeOptionalText(leadStatus) || null,
          status: "ACTIVE",
          updatedBy: userId,
        },
        select: { id: true },
      });

      imported += 1;
    } catch (error) {
      failures.push({
        row: rowNumber,
        name: opportunityName,
        reason:
          error instanceof Error ? error.message : "Failed to create opportunity",
      });
    }
  }

  if (imported > 0) {
    await writeAuditLog({
      entityType: "opportunity",
      entityId: "bulk_import",
      action: "imported",
      changes: [
        { field: "imported", old: null, new: imported },
        { field: "failed", old: null, new: failures.length },
      ],
      userId,
    });
  }

  revalidatePath("/[locale]/crm/opportunities", "page");

  return NextResponse.json({
    imported,
    failed: failures.length,
    failures,
  });
}
