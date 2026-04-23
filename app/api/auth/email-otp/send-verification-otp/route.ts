import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

const testOtpIdentifier = (email: string) => `test-otp-${email.toLowerCase()}`;
const signInOtpIdentifier = (email: string) => `sign-in-otp-${email.toLowerCase()}`;

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

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prismadb.verification.deleteMany({
      where: {
        identifier: {
          in: [testOtpIdentifier(email), signInOtpIdentifier(email)],
        },
      },
    });

    await prismadb.verification.create({
      data: {
        identifier: testOtpIdentifier(email),
        value: otp,
        expiresAt,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[OTP Send] Failed to create verification OTP", error);
    return NextResponse.json(
      { success: false, error: "Failed to create verification OTP" },
      { status: 500 }
    );
  }
}
