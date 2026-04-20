import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();

  const fallbackOtp = await prismadb.verification.findFirst({
    where: {
      identifier: `fallback-otp-${normalizedEmail}`,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (fallbackOtp) {
    return NextResponse.json({ otp: fallbackOtp.value, source: "fallback" });
  }

  // Test-only OTP capture remains available outside production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const ctx = await auth.$context;
    const otp = (ctx as any).test?.getOTP(email);
    if (otp) {
      return NextResponse.json({ otp, source: "test" });
    }
    return NextResponse.json({ error: "No OTP found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "testUtils not enabled" }, { status: 500 });
  }
}
