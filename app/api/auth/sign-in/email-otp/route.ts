import { NextRequest, NextResponse } from "next/server";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { prismadb } from "@/lib/prisma";

const testOtpIdentifier = (email: string) => `test-otp-${email.toLowerCase()}`;
const fallbackOtpIdentifier = (email: string) => `fallback-otp-${email.toLowerCase()}`;
const signInOtpIdentifier = (email: string) => `sign-in-otp-${email.toLowerCase()}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    const verification = await prismadb.verification.findFirst({
      where: {
        identifier: {
          in: [testOtpIdentifier(email), fallbackOtpIdentifier(email)],
        },
        value: otp,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired OTP" },
        { status: 401 }
      );
    }

    await prismadb.verification.deleteMany({
      where: {
        identifier: signInOtpIdentifier(email),
      },
    });

    await prismadb.verification.create({
      data: {
        identifier: signInOtpIdentifier(email),
        value: `${otp}:0`,
        expiresAt: verification.expiresAt,
      },
    });

    const forwardedRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ email, otp }),
    });

    return await authPost(forwardedRequest);
  } catch (error) {
    console.error("[OTP Sign-In] Failed to sign in with OTP", error);
    return NextResponse.json(
      { success: false, error: "Failed to sign in with OTP" },
      { status: 500 }
    );
  }
}
