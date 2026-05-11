import { NextRequest, NextResponse } from "next/server";
import { isPrismaAccessDeniedError, prismadb } from "@/lib/prisma";

const allowOtpPreview =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.ENABLE_OTP_PREVIEW === "true";

export async function GET(request: NextRequest) {
  if (!allowOtpPreview) {
    return NextResponse.json(
      { success: false, error: "Not available" },
      { status: 404 }
    );
  }

  try {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const verification = await prismadb.verification.findFirst({
      where: {
        identifier: {
          in: [
            `test-otp-${normalizedEmail}`,
            `fallback-otp-${normalizedEmail}`,
          ],
        },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return NextResponse.json(
        { success: false, error: "OTP not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      otp: verification.value,
      source: verification.identifier.startsWith("fallback-otp-")
        ? "fallback"
        : "test",
    });
  } catch (error) {
    console.error("[Test-OTP] Failed to fetch OTP", error);

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
      { success: false, error: "Failed to fetch OTP" },
      { status: 500 }
    );
  }
}
