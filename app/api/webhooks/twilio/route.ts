import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string;

    if (messageSid) {
      await prisma.crm_SMSLog.update({
        where: { twilioSid: messageSid },
        data: {
          status: messageStatus,
          errorMessage: errorCode || null,
        },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Twilio Webhook Error:", error);
    return new Response("Error", { status: 500 });
  }
}
