import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_COOKIE_NAME = "admin_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || "admin-super-secret-key-change-in-production"
);

// Routes that require regular auth
const protectedPrefixes = ["/dashboard", "/onboarding"];
// Routes that require ADMIN cookie
const adminProtectedPrefixes = ["/super-admin"];
// Routes that are only for unauthenticated users
const authRoutes = ["/login", "/register"];
// Public routes that never need auth
const publicRoutes = ["/", "/store", "/verify-warranty", "/warranty/verify", "/api/webhooks", "/portal"];

async function hasValidAdminSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export const proxy = auth(async function proxy(req: NextRequest & { auth: unknown }) {
  const { nextUrl } = req;
  const isLoggedIn = !!(req as unknown as { auth: { user?: unknown } | null }).auth?.user;
  const pathname = nextUrl.pathname;

  // Check if route is public
  const isPublic = publicRoutes.some(
    (route) => pathname.startsWith(route) || pathname === route
  );
  if (isPublic) return NextResponse.next();

  // API routes - let them handle their own auth
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // /admin/login — redirect to /super-admin if already has admin session
  if (pathname === "/admin/login" || pathname === "/admin/login/") {
    const adminLoggedIn = await hasValidAdminSession(req);
    if (adminLoggedIn) {
      return NextResponse.redirect(new URL("/super-admin", nextUrl));
    }
    return NextResponse.next();
  }

  // Super-admin routes — require admin session cookie
  const isAdminProtected = adminProtectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (isAdminProtected) {
    const adminLoggedIn = await hasValidAdminSession(req);
    if (!adminLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Auth routes - redirect to dashboard if already logged in
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Protected routes - redirect to login if not logged in
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
