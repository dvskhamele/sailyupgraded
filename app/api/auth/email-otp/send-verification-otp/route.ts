import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isPrismaAccessDeniedError, prismadb } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email/sendOtpEmail";

const testOtpIdentifier = (email: string) => `test-otp-${email.toLowerCase()}`;
const signInOtpIdentifier = (email: string) => `sign-in-otp-${email.toLowerCase()}`;
const otpIdentifiers = (email: string) => [
  testOtpIdentifier(email),
  `fallback-otp-${email.toLowerCase()}`,
  signInOtpIdentifier(email),
];
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const identifier = signInOtpIdentifier(email);

    await prismadb.verification.deleteMany({
      where: {
        identifier: {
          in: otpIdentifiers(email),
        },
      },
    });

    await prismadb.verification.create({
      data: {
        identifier,
        value: `${otp}:0`,
        expiresAt,
      },
    });

    try {
      const result = await sendOtpEmail({ email, otp });
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      await prismadb.verification.deleteMany({
        where: {
          identifier: {
            in: otpIdentifiers(email),
          },
        },
      });

      console.error("[OTP Send] Failed to send verification OTP email", {
        email,
        error,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to send verification OTP email",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[OTP Send] Failed to create verification OTP", error);

    if (isPrismaAccessDeniedError(error)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database credentials were rejected. Update DATABASE_URL in .env.local, then restart the dev server.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create verification OTP" },
      { status: 500 }
    );
  }
}
