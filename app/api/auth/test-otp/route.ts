import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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
        identifier: `test-otp-${normalizedEmail}`,
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

    return NextResponse.json({ success: true, otp: verification.value });
  } catch (error) {
    console.error("[Test-OTP] Failed to fetch OTP", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch OTP" },
      { status: 500 }
    );
  }
}
