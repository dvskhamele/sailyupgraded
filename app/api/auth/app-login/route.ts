import { prismadb } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Lightweight email-only login for the browser extension.
// Checks whether the email exists in the CRM user table.
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = (body?.email || "")
      .toString()
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const user = await prismadb.users.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No CRM account with that email" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? "",
        via: "crm",
      },
    });
  } catch (error) {
    console.error("[APP_LOGIN] Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
