import { makeSignature } from "better-auth/crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { getGoogleClientId } from "@/lib/env";
import { prismadb } from "@/lib/prisma";

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const USER_NOT_REGISTERED_MESSAGE =
  "Your account is not registered. Please contact administrator or register first.";

const googleLoginSchema = z.object({
  credential: z.string().min(20, "Google credential is required."),
  rememberMe: z.boolean().optional(),
});

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  exp?: string;
  iss?: string;
};

function getAuthSecret() {
  return process.env.BETTER_AUTH_SECRET || "development-secret-must-change";
}

function shouldUseSecureCookie() {
  const authUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return authUrl?.startsWith("https://") || process.env.NODE_ENV === "production";
}

function getSessionCookieName() {
  const prefix = shouldUseSecureCookie() ? "__Secure-" : "";
  return `${prefix}better-auth.session_token`;
}

async function signSessionToken(token: string) {
  return `${token}.${await makeSignature(token, getAuthSecret())}`;
}

async function verifyGoogleCredential(credential: string) {
  const googleClientId = getGoogleClientId();

  if (!googleClientId) {
    throw new Error("Google client ID is not configured.");
  }

  const response = await fetch(
    `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Google credential could not be verified.");
  }

  const tokenInfo = (await response.json()) as GoogleTokenInfo;
  const expiresAt = tokenInfo.exp ? Number(tokenInfo.exp) * 1000 : 0;
  const trustedIssuer =
    tokenInfo.iss === "https://accounts.google.com" ||
    tokenInfo.iss === "accounts.google.com";

  if (
    tokenInfo.aud !== googleClientId ||
    !trustedIssuer ||
    !tokenInfo.sub ||
    !tokenInfo.email ||
    tokenInfo.email_verified !== "true" ||
    expiresAt <= Date.now()
  ) {
    throw new Error("Invalid Google credential.");
  }

  return {
    email: tokenInfo.email.trim().toLowerCase(),
    name: tokenInfo.name,
    picture: tokenInfo.picture,
    googleId: tokenInfo.sub,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = googleLoginSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid Google login request." },
        { status: 400 },
      );
    }

    const googleProfile = await verifyGoogleCredential(parsed.data.credential);

    const user = await prismadb.users.findUnique({
      where: { email: googleProfile.email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        userStatus: true,
        userLanguage: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: USER_NOT_REGISTERED_MESSAGE },
        { status: 401 },
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
    const sessionToken = crypto.randomUUID();

    const [session] = await prismadb.$transaction([
      prismadb.session.create({
        data: {
          token: sessionToken,
          userId: user.id,
          expiresAt,
          ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip"),
          userAgent: req.headers.get("user-agent"),
        },
      }),
      prismadb.account.upsert({
        where: {
          id: `google:${googleProfile.googleId}`,
        },
        update: {
          accountId: googleProfile.googleId,
          providerId: "google",
          userId: user.id,
        },
        create: {
          id: `google:${googleProfile.googleId}`,
          accountId: googleProfile.googleId,
          providerId: "google",
          userId: user.id,
        },
      }),
      prismadb.users.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
          emailVerified: true,
          image: user.image || googleProfile.picture || undefined,
          name: user.name || googleProfile.name || undefined,
        },
      }),
    ]);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || googleProfile.name,
        image: user.image || googleProfile.picture,
        role: user.role,
        userStatus: user.userStatus,
        userLanguage: user.userLanguage,
      },
      session: {
        expiresAt: session.expiresAt,
      },
    });

    response.cookies.set({
      name: getSessionCookieName(),
      value: await signSessionToken(sessionToken),
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: parsed.data.rememberMe === false ? undefined : SESSION_MAX_AGE_SECONDS,
      expires: parsed.data.rememberMe === false ? undefined : expiresAt,
    });

    return response;
  } catch (error) {
    console.error("[GOOGLE_LOGIN]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong with Google login.",
      },
      { status: 401 },
    );
  }
}
