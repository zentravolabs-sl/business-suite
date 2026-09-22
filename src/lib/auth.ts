import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/schemas/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            businesses: {
              include: {
                business: true,
                role: {
                  include: {
                    permissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        if (user.status !== "ACTIVE") {
          throw new Error("Account is not active.");
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          businesses: user.businesses.map((ub) => ({
            businessId: ub.businessId,
            businessName: ub.business.name,
            businessSlug: ub.business.slug,
            branchId: ub.branchId,
            roleId: ub.roleId,
            roleName: ub.role?.name,
            isOwner: ub.isOwner,
            permissions: ub.role?.permissions.map((rp) => rp.permission.key) ?? [],
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.avatar = (user as any).avatar;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.businesses = (user as any).businesses;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).avatar = token.avatar;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).businesses = token.businesses;
      }
      return session;
    },
  },
});
