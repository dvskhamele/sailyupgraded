import { NextResponse } from "next/server";
import { sendSMS } from "@/actions/crm/sms/send-sms";

export async function POST(req: Request) {
  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing 'to' or 'message' field" },
        { status: 400 }
      );
    }

    const result = await sendSMS({ to, message });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
