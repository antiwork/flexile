import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import env from "@/env";
import { assertDefined } from "@/utils/assert";

const otpLoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const impersonationSchema = z.object({
  targetEmail: z.string().email(),
  adminToken: z.string(),
});

export const authOptions = {
  providers: [
    CredentialsProvider({
      id: "otp",
      name: "Email OTP",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "Enter your email",
        },
        otp: {
          label: "OTP Code",
          type: "text",
          placeholder: "Enter 6-digit OTP",
        },
      },
      async authorize(credentials, req) {
        const validation = otpLoginSchema.safeParse(credentials);

        if (!validation.success) throw new Error("Invalid email or OTP");

        try {
          const response = await fetch(`${assertDefined(req.headers?.origin)}/internal/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: validation.data.email,
              otp_code: validation.data.otp,
              token: env.API_SECRET_TOKEN,
            }),
          });

          if (!response.ok) {
            throw new Error(
              z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
                "Authentication failed, please try again.",
            );
          }

          const data = z
            .object({
              user: z.object({
                id: z.number(),
                email: z.string(),
                name: z.string().nullable(),
                legal_name: z.string().nullable(),
                preferred_name: z.string().nullable(),
              }),
              jwt: z.string(),
            })
            .parse(await response.json());

          return {
            ...data.user,
            id: data.user.id.toString(),
            name: data.user.name ?? "",
            legalName: data.user.legal_name ?? "",
            preferredName: data.user.preferred_name ?? "",
            jwt: data.jwt,
          };
        } catch {
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "impersonation",
      name: "Admin Impersonation",
      credentials: {
        targetEmail: {
          label: "Target User Email",
          type: "email",
        },
        adminToken: {
          label: "Admin Token",
          type: "text",
        },
      },
      async authorize(credentials, req) {
        const validation = impersonationSchema.safeParse(credentials);

        if (!validation.success) throw new Error("Invalid impersonation credentials");

        try {
          const response = await fetch(`${assertDefined(req.headers?.origin)}/internal/admin/impersonate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-flexile-auth": `Bearer ${validation.data.adminToken}`,
            },
            body: JSON.stringify({
              email: validation.data.targetEmail,
              token: env.API_SECRET_TOKEN,
            }),
          });

          if (!response.ok) {
            throw new Error(
              z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
                "Impersonation failed, please try again.",
            );
          }

          const data = z
            .object({
              user: z.object({
                id: z.number(),
                email: z.string(),
                name: z.string().nullable(),
                legal_name: z.string().nullable(),
                preferred_name: z.string().nullable(),
              }),
              jwt: z.string(),
              impersonated_by: z.object({
                id: z.string(),
                email: z.string(),
                name: z.string(),
              }),
            })
            .parse(await response.json());

          return {
            ...data.user,
            id: data.user.id.toString(),
            name: data.user.name ?? "",
            legalName: data.user.legal_name ?? "",
            preferredName: data.user.preferred_name ?? "",
            jwt: data.jwt,
            impersonatedBy: data.impersonated_by,
          };
        } catch {
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
    jwt({ token, user }) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- next-auth types are wrong
      if (!user) return token;
      token.jwt = (user as any).jwt;
      token.legalName = (user as any).legalName ?? "";
      token.preferredName = (user as any).preferredName ?? "";
      if ((user as any).impersonatedBy) {
        token.impersonatedBy = (user as any).impersonatedBy;
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, user: { ...session.user, ...token, id: token.sub } };
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;
