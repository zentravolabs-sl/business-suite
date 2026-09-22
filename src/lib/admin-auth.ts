/**
 * Admin authentication system — completely separate from NextAuth.
 * Uses the AdminUser model + a signed JWT stored in an httpOnly cookie.
 * This avoids any conflict with the regular user NextAuth session.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "admin_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || "admin-super-secret-key-change-in-production"
);
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export interface AdminSession {
  id: string;
  email: string;
  name: string;
  [key: string]: unknown;
}


// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signInAdmin(
  email: string,
  password: string
): Promise<{ success: true; admin: AdminSession } | { success: false; error: string }> {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      return { success: false, error: "Invalid email or password." };
    }
    if (!admin.isActive) {
      return { success: false, error: "Admin account is disabled." };
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid email or password." };
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const session: AdminSession = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    };

    // Create signed JWT
    const token = await new SignJWT(session)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(JWT_SECRET);

    // Set httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return { success: true, admin: session };
  } catch (err) {
    console.error("[admin-auth] signInAdmin error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Get Session ──────────────────────────────────────────────────────────────

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

// ─── Require Session (server guard) ──────────────────────────────────────────

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
