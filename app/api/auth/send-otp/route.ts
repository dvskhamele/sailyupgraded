import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/email/sendOtpEmail";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const OTP_REGEX = /^\d{6}$/;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email address.",
          error: { code: "INVALID_EMAIL", message: "Invalid email address." },
        },
        { status: 400 }
      );
    }

    if (!OTP_REGEX.test(otp)) {
      return NextResponse.json(
        {
          success: false,
          message: "OTP is required.",
          error: { code: "INVALID_OTP", message: "OTP is required." },
        },
        { status: 400 }
      );
    }

    // TODO: Add rate limiting here by IP/email before sending OTP in production.
    const result = await sendOtpEmail({ email, otp });

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[OTP EMAIL] API route failed", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to send OTP right now.",
        error:
          error instanceof Error
            ? { code: "OTP_EMAIL_FAILED", message: error.message }
            : { code: "OTP_EMAIL_FAILED", message: "Unknown error" },
      },
      { status: 500 }
    );
  }
}
