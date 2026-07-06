import { NextRequest, NextResponse } from "next/server";
import { makeSignature } from "better-auth/crypto";
import { findCurrentOrganizationForUser } from "@/lib/organization-queries";
import {
  isPrismaAccessDeniedError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const USER_NOT_REGISTERED_MESSAGE =
  "Your account is not registered. Please contact administrator.";

const otpIdentifiers = (email: string) => [
  `sign-in-otp-${email}`,
  `test-otp-${email}`,
  `fallback-otp-${email}`,
];

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

function getOtpValueCandidates(otp: string) {
  return [otp, `${otp}:0`];
}

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

    const normalizedEmail = email.trim().toLowerCase();

    const result = await withPrismaRetry(async () => {
      const verification = await prismadb.verification.findFirst({
        where: {
          identifier: {
            in: otpIdentifiers(normalizedEmail),
          },
          value: {
            in: getOtpValueCandidates(otp),
          },
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!verification) {
        return {
          error: "Invalid or expired OTP",
          status: 401,
        } as const;
      }

      // Upsert user (create if not exists, update if exists)
      const user = await prismadb.users.upsert({
        where: { email: normalizedEmail },
        create: {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          role: 'USER',
          userStatus: 'ACTIVE',
          userLanguage: 'en',
        },
        update: {
          lastLoginAt: new Date(),
        },
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

      const organization = await findCurrentOrganizationForUser(user.id);
      // if (!organization) {
      //   return {
      //     error: "No organization is assigned to this user.",
      //     status: 403,
      //   } as const;
      // }

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
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              request.headers.get("x-real-ip"),
            userAgent: request.headers.get("user-agent"),
          },
        }),
        prismadb.users.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
          },
        }),
        prismadb.verification.deleteMany({
          where: {
            identifier: {
              in: otpIdentifiers(normalizedEmail),
            },
          },
        }),
      ]);

      return {
        session,
        sessionToken,
        user,
        organization,
        expiresAt,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image,
        role: result.user.role,
        userStatus: result.user.userStatus,
        userLanguage: result.user.userLanguage,
        organizationId: result.organization?.id ?? null,
        organizationRole: result.organization?.role ?? null,
      },
      organization: result.organization,
       redirectTo: result.organization ? "/en/crm/dashboard" : "/en/create-organization",
      session: {
        expiresAt: result.session.expiresAt,
      },
    });

    response.cookies.set({
      name: getSessionCookieName(),
      value: await signSessionToken(result.sessionToken),
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      expires: result.expiresAt,
    });

    return response;
  } catch (error) {
    console.error("[OTP Sign-In] Failed to sign in with OTP", error);

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
      { success: false, error: "Failed to sign in with OTP" },
      { status: 500 }
    );
  }
}
