import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";
import { ac, admin, member, viewer } from "@/lib/auth-permissions";

const authBaseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL;

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [
    emailOTPClient(),
    adminClient({
      ac,
      roles: { admin, member, viewer },
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
