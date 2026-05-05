import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, testUtils } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { prismadb } from "@/lib/prisma";
import { ac, admin, member, viewer } from "@/lib/auth-permissions";
import { newUserNotify } from "@/lib/new-user-notify";
import resendHelper from "@/lib/resend";
import { getEmailFromAddress, getGoogleClientId, getGoogleClientSecret } from "@/lib/env";

function getCanonicalAppUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

function getTrustedAuthOrigins() {
  const origins = new Set<string>();

  const addOrigin = (value?: string) => {
    if (!value) return;
    try {
      const normalized = value.includes("://") ? value : `https://${value}`;
      origins.add(new URL(normalized).origin);
    } catch {
      // Ignore invalid env values instead of crashing auth boot.
    }
  };

  addOrigin(process.env.BETTER_AUTH_URL);
  addOrigin(process.env.NEXT_PUBLIC_APP_URL);
  addOrigin(process.env.VERCEL_URL);
  addOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  origins.add("https://*.vercel.app");

  return Array.from(origins);
}

const appUrl = getCanonicalAppUrl();
const isDemo = process.env.NEXT_PUBLIC_APP_URL === "https://demo.nextcrm.io";
const emailFromAddress = getEmailFromAddress();
const googleClientId = getGoogleClientId();
const googleClientSecret = getGoogleClientSecret();
const allowOtpPreview =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.ENABLE_OTP_PREVIEW === "true";
const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const configuredAdminEmails = [
  configuredAdminEmail,
  ...((process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)),
  "dr.oscar@signimus.com",
].filter(Boolean);
const bootstrapAdminEmails = new Set(configuredAdminEmails);
const seededTestUserEmail = (
  process.env.TEST_USER_EMAIL || "test@nextcrm.app"
).trim().toLowerCase();
const otpFallbackIdentifier = (email: string) => `fallback-otp-${email.toLowerCase()}`;
const databaseUrl = process.env.DATABASE_URL ?? "";
const databaseProvider =
  databaseUrl.startsWith("postgres") || databaseUrl.startsWith("postgresql")
    ? "postgresql"
    : databaseUrl.startsWith("mysql") || databaseUrl.startsWith("mariadb")
      ? "mysql"
      : databaseUrl === ""
        ? "mysql" // Default to mysql for the project's primary DB type
        : "sqlite";

function shouldBootstrapAdminEmail(email?: string | null) {
  return Boolean(email && bootstrapAdminEmails.has(email.trim().toLowerCase()));
}

async function promoteBootstrapAdmin(userId: string) {
  const dbUser = await prismadb.users.findUnique({ where: { id: userId } });
  if (!dbUser) return null;

  if (!shouldBootstrapAdminEmail(dbUser.email)) {
    return dbUser;
  }

  if (dbUser.role === "admin" && dbUser.userStatus === "ACTIVE") {
    return dbUser;
  }

  return await prismadb.users.update({
    where: { id: userId },
    data: { role: "admin", userStatus: "ACTIVE" },
  });
}

export const auth = betterAuth({
  database: prismaAdapter(prismadb, { provider: databaseProvider }),
  secret: process.env.BETTER_AUTH_SECRET || "development-secret-must-change",
  baseURL: appUrl,
  trustedOrigins: getTrustedAuthOrigins(),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          await promoteBootstrapAdmin(session.userId);
        },
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,       // 7 days
    updateAge: 60 * 60 * 24,            // refresh every 24 hours
  },

  user: {
    modelName: "Users",
    fields: {
      createdAt: "created_on",
      updatedAt: "updated_at",
      image: "image",
    },
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "member",
        input: false,
      },
      userStatus: {
        type: "string",
        defaultValue: isDemo ? "ACTIVE" : "PENDING",
        input: false,
      },
      userLanguage: {
        type: "string",
        defaultValue: "en",
        input: false,
      },
      avatar: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  socialProviders: {
    ...(googleClientId && googleClientSecret ? {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    } : {}),
  },

  emailAndPassword: {
    enabled: false,
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[Auth] Generating OTP for ${email}: ${otp} (${type})`);
        
        try {
          // 1. Clean up old fallbacks for this email
          await prismadb.verification.deleteMany({
            where: { identifier: otpFallbackIdentifier(email) },
          });
        } catch (dbError) {
          console.error("[Auth] Failed to clean up old fallback OTPs", dbError);
          // Continue anyway
        }

        try {
          const resend = await resendHelper();
          if (resend && emailFromAddress) {
            await resend.emails.send({
              from: `${process.env.NEXT_PUBLIC_APP_NAME || "NextCRM"} <${emailFromAddress}>`,
              to: email,
              subject: `Your verification code: ${otp}`,
              text: `Your one-time verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
            });
            console.log(`[Auth] OTP email sent via Resend to ${email}`);
          } else {
            throw new Error("Email service not configured or EMAIL_FROM missing");
          }
        } catch (e) {
          if (!allowOtpPreview) {
            console.error(
              `[Auth] OTP email send failed for ${email} and preview fallback is disabled`,
              e
            );
            throw e instanceof Error
              ? e
              : new Error("Failed to send verification code");
          }

          // Preserve sign-in flow when email delivery is unavailable by storing
          // a short-lived fallback OTP the UI can display directly.
          try {
            await prismadb.verification.create({
              data: {
                identifier: otpFallbackIdentifier(email),
                value: otp,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
              },
            });
            console.warn(`[Auth] OTP email send failed for ${email}; stored fallback code in DB`, e instanceof Error ? e.message : e);
          } catch (dbCreateError) {
            console.error("[Auth] CRITICAL: Failed to store fallback OTP in DB", dbCreateError);
          }
        }
      },
    }),
    // testUtils captures OTPs for E2E testing — only enabled in non-production
    ...(process.env.NODE_ENV !== "production"
      ? [testUtils({ captureOTP: true })]
      : []),
    adminPlugin({
      ac,
      roles: { admin, member, viewer },
      defaultRole: "member",
    }),
  ],


  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: googleClientId && googleClientSecret ? ["google"] : [],
    },
  },

  callbacks: {
    async onUserCreated(user: { id: string }) {
      // Check if this is the first user — make them admin
      const dbUser = await promoteBootstrapAdmin(user.id);
      if (!dbUser) return;

      const normalizedEmail = dbUser.email.trim().toLowerCase();
      const shouldPromoteConfiguredAdmin =
        shouldBootstrapAdminEmail(normalizedEmail);
      const shouldPromoteFirstRealUser =
        normalizedEmail !== seededTestUserEmail &&
        (await prismadb.users.count({
          where: {
            email: {
              not: seededTestUserEmail,
            },
          },
        })) === 1;

      if (shouldPromoteConfiguredAdmin || shouldPromoteFirstRealUser) {
        await prismadb.users.update({
          where: { id: user.id },
          data: { role: "admin", userStatus: "ACTIVE" },
        });
      } else if (!isDemo) {
        // Notify admins about new pending user
        await newUserNotify(dbUser);
      }
    },
  },
});

export type Session = typeof auth.$Infer.Session;
