import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import env from "../env/client";

// Extend the built-in session types
declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    jwt: string;
    legalName: string;
    preferredName: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      legalName: string;
      preferredName: string;
    };
    jwt: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    jwt: string;
    legalName: string;
    preferredName: string;
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  otp_code: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp_code: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        try {
          const validatedFields = loginSchema.safeParse(credentials);

          if (!validatedFields.success) {
            return null;
          }

          const { email, otp_code } = validatedFields.data;

          const apiUrl = env.NEXT_PUBLIC_API_URL;

          const response = await fetch(`${apiUrl}/api/v1/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              otp_code,
              token: env.NEXT_PUBLIC_API_SECRET_TOKEN,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Login failed");
          }

          const data = await response.json();

          return {
            id: data.user.id.toString(),
            email: data.user.email,
            name: data.user.name,
            jwt: data.jwt,
            legalName: data.user.legal_name,
            preferredName: data.user.preferred_name,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.jwt = user.jwt;
        token.legalName = user.legalName;
        token.preferredName = user.preferredName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.jwt = token.jwt;
        session.user.legalName = token.legalName;
        session.user.preferredName = token.preferredName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login2",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
});

export async function sendOTP(email: string) {
  const apiUrl = env.NEXT_PUBLIC_API_URL;

  const response = await fetch(`${apiUrl}/api/v1/email_otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      token: env.NEXT_PUBLIC_API_SECRET_TOKEN,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to send OTP");
  }

  return await response.json();
}