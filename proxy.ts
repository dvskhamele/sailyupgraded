import { NextRequest, NextResponse } from "next/server";

const bypassLogin =
  process.env.BYPASS_LOGIN === "true" ||
  process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

const STATIC_FILE_PATTERN = /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|webmanifest|webp|woff|woff2)$/i;

function hasSessionCookie(req: NextRequest) {
  const cookieNames = [
    "better-auth.session_token",
    "better-auth-session_token",
    "__Secure-better-auth.session_token",
    "__Secure-better-auth-session_token",
  ];

  return cookieNames.some((name) => Boolean(req.cookies.get(name)));
}

function isStaticAsset(pathname: string) {
  return (
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    STATIC_FILE_PATTERN.test(pathname)
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/en" ||
    pathname === "/en/sign-in" ||
    pathname === "/landing" ||
    pathname.startsWith("/landing/") ||
    isStaticAsset(pathname)
  );
}

function isProtectedCrmPath(pathname: string) {
  return pathname === "/crm" || pathname.startsWith("/crm/");
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

if (bypassLogin && !isProtectedCrmPath(path)) {
  return NextResponse.next();
}

  if (isProtectedCrmPath(path) && !hasSessionCookie(req)) {
    return NextResponse.redirect(new URL("/en/sign-in", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|trpc|_next|__nextjs|_vercel|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
