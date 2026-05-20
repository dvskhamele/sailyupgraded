import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Development OTP fallback is disabled. Use email OTP delivery.",
    },
    { status: 404 }
  );
}
