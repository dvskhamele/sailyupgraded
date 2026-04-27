import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
const AUTH_PATHS = ["/sign-in", "/register", "/pending", "/inactive"];

// Admin-only API paths — cookie presence checked here, role checked server-side
const ADMIN_ONLY_PATHS = [
  "/api/user/activateAdmin",
  "/api/user/deactivateAdmin",
  "/api/user/activate",
  "/api/user/deactivate",
  "/api/user/inviteuser",
  "/api/admin",
];

function getLocalePrefix(pathname: string) {
  const segment = pathname.split("/")[1];
  return routing.locales.includes(segment as (typeof routing.locales)[number])
    ? segment
    : routing.defaultLocale;
}

function hasLocalePrefix(pathname: string) {
  const segment = pathname.split("/")[1];
  return routing.locales.includes(segment as (typeof routing.locales)[number]);
}

function hasSessionCookie(req: NextRequest) {
  const cookieNames = [
    "better-auth.session_token",
    "better-auth-session_token",
    "__Secure-better-auth.session_token",
    "__Secure-better-auth-session_token",
  ];

  return cookieNames.some((name) => Boolean(req.cookies.get(name)));
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Inngest webhook — pass through, Inngest handles its own auth via signing key
  if (path.startsWith("/api/inngest")) {
    return NextResponse.next();
  }

  // better-auth API routes — pass through to better-auth handler
  if (path.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const sessionCookie = hasSessionCookie(req);

  // Admin-only routes — require session cookie (role checked server-side)
  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) {
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Non-API routes — redirect to sign-in if no session cookie
  if (!path.startsWith("/api")) {
    if (!hasLocalePrefix(path)) {
      const normalizedPath = path === "/" ? "" : path;
      if (!sessionCookie) {
        return NextResponse.redirect(
          new URL(`/${routing.defaultLocale}/sign-in`, req.nextUrl)
        );
      }

      return NextResponse.redirect(
        new URL(`/${routing.defaultLocale}${normalizedPath}`, req.nextUrl)
      );
    }

    if (!sessionCookie) {
      const isAuthPage = AUTH_PATHS.some((p) => path.includes(p));
      if (!isAuthPage) {
        const locale = getLocalePrefix(path);
        return NextResponse.redirect(new URL(`/${locale}/sign-in`, req.nextUrl));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Admin-only API paths
    "/api/user/activateAdmin/:path*",
    "/api/user/deactivateAdmin/:path*",
    "/api/user/activate/:path*",
    "/api/user/deactivate/:path*",
    "/api/user/inviteuser",
    "/api/admin/:path*",
    // better-auth API
    "/api/auth/:path*",
    // All non-API routes (existing intl matcher)
    "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
  ],
};
