import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isPrismaAccessDeniedError, prismadb } from "@/lib/prisma";

const otpIdentifier = (email: string) => `sign-in-otp-${email.toLowerCase()}`;
const fallbackOtpIdentifier = (email: string) =>
  `fallback-otp-${email.toLowerCase()}`;
const allowOtpBypass =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.ENABLE_OTP_PREVIEW === "true";

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function POST(request: NextRequest) {
  if (!allowOtpBypass) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prismadb.verification.deleteMany({
      where: {
        identifier: {
          in: [otpIdentifier(email), fallbackOtpIdentifier(email)],
        },
      },
    });

    await prismadb.verification.createMany({
      data: [
        {
          identifier: otpIdentifier(email),
          value: `${otp}:0`,
          expiresAt,
        },
        {
          identifier: fallbackOtpIdentifier(email),
          value: otp,
          expiresAt,
        },
      ],
    });

    return NextResponse.json({ otp, source: "dev-fallback" });
  } catch (error) {
    console.error("[Auth] Failed to create development OTP fallback", error);

    if (isPrismaAccessDeniedError(error)) {
      return NextResponse.json(
        {
          error:
            "Database credentials were rejected. Update DATABASE_URL in .env.local, then restart the dev server.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create verification code" },
      { status: 500 }
    );
  }
}
