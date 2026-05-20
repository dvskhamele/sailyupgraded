import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, testUtils } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { prismadb } from "@/lib/prisma";
import { ac, admin, member, viewer } from "@/lib/auth-permissions";
import { newUserNotify } from "@/lib/new-user-notify";
import { sendOtpEmail } from "@/lib/email/sendOtpEmail";
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/env";

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
const googleClientId = getGoogleClientId();
const googleClientSecret = getGoogleClientSecret();
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
    // Better Auth's Prisma adapter expects the Prisma client delegate name.
    // The Prisma schema model is `Users`, but the generated delegate is `users`.
    modelName: "users",
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
        try {
          console.info("[OTP EMAIL] Auth callback sending OTP", {
            email,
            type,
          });

          await sendOtpEmail({ email, otp });
        } catch (error) {
          console.error("[OTP EMAIL] Auth callback failed", {
            email,
            type,
            error,
          });
          throw new Error("Unable to send OTP right now.");
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
