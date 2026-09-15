import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getNextAuthSecret } from "@/lib/env";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/" },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await db.user.findUnique({
          where: { email: creds.email.toLowerCase() },
        });
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await db.auditLog.create({
          data: {
            actorId: user.id,
            action: "auth.login",
            entityType: "User",
            entityId: user.id,
            afterJson: JSON.stringify({ role: user.role }),
          },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.sessionVersion = (user as any).sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
  // Resolve secret through centralized env validation.
  // Production throws if missing; dev generates an ephemeral per-process secret.
  get secret() {
    return getNextAuthSecret();
  },
};

export type AppRole = "ADMIN" | "OPERATOR" | "WAREHOUSE";
