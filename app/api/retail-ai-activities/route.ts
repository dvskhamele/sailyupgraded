import { NextRequest, NextResponse } from "next/server";
import { getRetailAIActivities } from "@/actions/crm/retail-ai-activities/get-retail-ai-activities";
import { createRetailAIActivityFromWebhook } from "@/lib/retail-ai/service";
import type { RetailAIActivityFilters } from "@/actions/crm/retail-ai-activities/types";

function parseFilters(request: NextRequest): RetailAIActivityFilters {
  const { searchParams } = request.nextUrl;
  const minAIConfidence = searchParams.get("minAIConfidence");
  const maxAIConfidence = searchParams.get("maxAIConfidence");

  return {
    type: (searchParams.get("type") as RetailAIActivityFilters["type"]) ?? "all",
    status: (searchParams.get("status") as RetailAIActivityFilters["status"]) ?? "all",
    contactId: searchParams.get("contactId") ?? undefined,
    assignedTo: searchParams.get("assignedTo") ?? undefined,
    aiStatus: searchParams.get("aiStatus") ?? undefined,
    minAIConfidence: minAIConfidence ? Number(minAIConfidence) : undefined,
    maxAIConfidence: maxAIConfidence ? Number(maxAIConfidence) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const cursorParam = request.nextUrl.searchParams.get("cursor");
  let cursor;

  try {
    cursor = cursorParam ? JSON.parse(cursorParam) : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const result = await getRetailAIActivities(cursor, parseFilters(request));
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  console.log("[RETAIL AI ACTIVITIES ROUTE] >>>>> WEBHOOK HIT (retail-ai-activities) <<<<<");

  let payload: unknown;
  try {
    const rawBody = await request.text();
    console.log("[RETAIL AI ACTIVITIES ROUTE] Raw Body:", rawBody);
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[RETAIL AI ACTIVITIES ROUTE] Invalid JSON payload");
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createRetailAIActivityFromWebhook(payload, {
    receivedAt: new Date(),
  });

  return NextResponse.json(result, {
    status: result.status === "created" ? 201 : 200,
  });
}
