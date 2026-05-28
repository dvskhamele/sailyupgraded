import { NextRequest, NextResponse } from "next/server";
import { createRetailAIActivityFromWebhook } from "@/lib/retail-ai/service";

export async function POST(req: NextRequest) {
  console.log("[RETAIL AI WEBHOOK] >>>>> WEBHOOK HIT (webhooks/retail-ai) <<<<<");
  try {
    const rawBody = await req.text();
    console.log("[RETAIL AI WEBHOOK] Raw Body:", rawBody);
    
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("[RETAIL AI WEBHOOK] Invalid JSON:", rawBody);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = await createRetailAIActivityFromWebhook(payload, {
      receivedAt: new Date(),
    });

    console.log("[RETAIL AI WEBHOOK] Result:", JSON.stringify(result, null, 2));

    return NextResponse.json(result, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error: any) {
    console.error("[RETAIL AI WEBHOOK] CRITICAL ERROR:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process Retail AI webhook",
        stack: error.stack
      },
      { status: error.message?.includes("Invalid") ? 400 : 500 },
    );
  }
}
