import { NextRequest, NextResponse } from "next/server";

// Paths that don't require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/api/auth",
  "/api/health",
  "/api/demo",
  "/_next",
  "/favicon.ico",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and the landing page
  if (
    pathname === "/" ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // better-auth sets this cookie on sign-in
  const sessionCookie =
    req.cookies.get("better-auth.session_token") ??
    req.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
