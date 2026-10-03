import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

class AuthenticationUnavailable extends CredentialsSignin {
  code = "service_unavailable";
}

const authSecret = process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? "daymark-local-development-only-auth-secret-2026" : undefined);

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: { type: "password" } },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
          if (!user || user.isBanned || !(await compare(parsed.data.password, user.passwordHash))) return null;

          return { id: user.id, email: user.email, name: user.email, role: user.role };
        } catch {
          throw new AuthenticationUnavailable();
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub && isUserRole(token.role)) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
});