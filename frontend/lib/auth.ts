import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { z } from "zod";
import env from "@/env";
import { assertDefined } from "@/utils/assert";

const otpLoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const authOptions = {
  providers: [
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
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
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle GitHub OAuth
      if (account?.provider === "github" && profile?.email) {
        try {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TODO
          const githubProfile = profile as { id: string; email: string };

          // Try login first
          const loginResponse = await fetch(`${env.NEXTAUTH_URL}/internal/oauth/github_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oauth: {
                email: githubProfile.email,
                github_uid: githubProfile.id,
              },
              token: env.API_SECRET_TOKEN,
            }),
          });

          if (loginResponse.ok) {
            const data = z
              .object({
                user: z.object({
                  legal_name: z.string().nullable(),
                  preferred_name: z.string().nullable(),
                }),
                jwt: z.string(),
              })
              .parse(await loginResponse.json());

            user.jwt = data.jwt;
            user.legalName = data.user.legal_name ?? "";
            user.preferredName = data.user.preferred_name ?? "";
            return true;
          }

          // If login failed, try signup
          const signupResponse = await fetch(`${env.NEXTAUTH_URL}/internal/oauth/github_signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oauth: {
                email: githubProfile.email,
                github_uid: githubProfile.id,
              },
              token: env.API_SECRET_TOKEN,
            }),
          });

          if (signupResponse.ok) {
            const data = z
              .object({
                user: z.object({
                  legal_name: z.string().nullable(),
                  preferred_name: z.string().nullable(),
                }),
                jwt: z.string(),
              })
              .parse(await signupResponse.json());

            user.jwt = data.jwt;
            user.legalName = data.user.legal_name ?? "";
            user.preferredName = data.user.preferred_name ?? "";
            return true;
          }

          // If both failed, deny sign in
          return false;
        } catch {
          return false;
        }
      }

      // Allow other providers (like credentials)
      return true;
    },
    jwt({ token, user }) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- next-auth types are wrong
      if (!user) return token;
      token.jwt = user.jwt;
      token.legalName = user.legalName ?? "";
      token.preferredName = user.preferredName ?? "";
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
