import { NextRequest, NextResponse } from "next/server";
import { createRetailAIActivityFromWebhook } from "@/lib/retail-ai/service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await createRetailAIActivityFromWebhook(payload, {
      receivedAt: new Date(),
    });

    return NextResponse.json(result, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    console.error("Retail AI Webhook Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process Retail AI webhook",
      },
      { status: error instanceof Error && error.message.includes("Invalid") ? 400 : 500 },
    );
  }
}
