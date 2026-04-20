import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, testUtils } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { prismadb } from "@/lib/prisma";
import { ac, admin, member, viewer } from "@/lib/auth-permissions";
import { newUserNotify } from "@/lib/new-user-notify";
import resendHelper from "@/lib/resend";

const isDemo = process.env.NEXT_PUBLIC_APP_URL === "https://demo.nextcrm.io";
const otpFallbackIdentifier = (email: string) => `fallback-otp-${email.toLowerCase()}`;

export const auth = betterAuth({
  database: prismaAdapter(prismadb, { provider: "mysql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  advanced: {
    database: {
      generateId: "uuid",
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
    google: {
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    },
  },

  emailAndPassword: {
    enabled: false,
  },

  plugins: [
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        await prismadb.verification.deleteMany({
          where: { identifier: otpFallbackIdentifier(email) },
        });

        try {
          const resend = await resendHelper();
          await resend.emails.send({
            from: `${process.env.NEXT_PUBLIC_APP_NAME} <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: `Your verification code: ${otp}`,
            text: `Your one-time verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
          });
        } catch (e) {
          // Preserve sign-in flow when email delivery is unavailable by storing
          // a short-lived fallback OTP the UI can display directly.
          await prismadb.verification.create({
            data: {
              identifier: otpFallbackIdentifier(email),
              value: otp,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
          });

          console.error(`[Auth] OTP email send failed for ${email}; using fallback code`, e);
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
      trustedProviders: ["google"],
    },
  },

  callbacks: {
    async onUserCreated(user: { id: string }) {
      // Check if this is the first user — make them admin
      const count = await prismadb.users.count();
      if (count === 1) {
        await prismadb.users.update({
          where: { id: user.id },
          data: { role: "admin", userStatus: "ACTIVE" },
        });
      } else if (!isDemo) {
        // Notify admins about new pending user
        const dbUser = await prismadb.users.findUnique({ where: { id: user.id } });
        if (dbUser) {
          await newUserNotify(dbUser);
        }
      }
    },
  },
});

export type Session = typeof auth.$Infer.Session;
