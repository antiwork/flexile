import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import type { Account, NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import env from "@/env";
import { assertDefined } from "@/utils/assert";

const otpLoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
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
    ...(process.env.NODE_ENV !== "test" && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
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

export function handler(req: NextRequest, ...params: unknown[]) {
  const authContext = req.cookies.get("auth_context")?.value;

  const augmentedOptions: NextAuthOptions = {
    ...authOptions,
    providers: [
      ...authOptions.providers,
      ...(process.env.NODE_ENV === "test"
        ? [
            CredentialsProvider({
              id: "google",
              name: "Google (Test)",
              credentials: {},
              authorize() {
                const testGoogleUser = req.cookies.get("test_google_user")?.value;

                if (testGoogleUser) {
                  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                  const user = JSON.parse(testGoogleUser) as {
                    email: string;
                    googleUid: string;
                  };

                  const result = {
                    id: user.googleUid,
                    email: user.email,
                    name: "",
                    jwt: "",
                    legalName: "",
                    preferredName: "",
                  };
                  return result;
                }
                return null;
              },
            }),
          ]
        : []),
    ],
    callbacks: {
      ...authOptions.callbacks,
      async signIn({ user, account }: { user: User; account: Account | null }) {
        if (account?.provider === "google") {
          const invitationToken = req.cookies.get("auth_invitation_token")?.value;
          const endpoint = authContext === "signup" ? "/internal/oauth/oauth_signup" : "/internal/oauth/oauth_login";
          const requestBody: Record<string, unknown> = {
            email: user.email,
            token: env.API_SECRET_TOKEN,
          };

          if (invitationToken) {
            requestBody.invitation_token = invitationToken;
          }

          const response = await fetch(`${process.env.NEXTAUTH_URL}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const parsed = z.object({ error: z.string() }).safeParse(await response.json());
            throw new Error(parsed.success ? parsed.data.error : "Authentication failed");
          }

          const data = z
            .object({
              user: z.object({
                id: z.number(),
                email: z.string().email(),
                name: z.string().nullable().optional(),
                legal_name: z.string().nullable().optional(),
                preferred_name: z.string().nullable().optional(),
              }),
              jwt: z.string(),
            })
            .parse(await response.json());

          user.jwt = data.jwt;
          user.legalName = data.user.legal_name ?? "";
          user.preferredName = data.user.preferred_name ?? "";
          user.name = data.user.name ?? user.name;
          user.id = data.user.id.toString();
        }

        return true;
      },
    },
    pages: {
      ...authOptions.pages,
      error: authContext === "signup" ? "/signup" : "/login",
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return NextAuth(augmentedOptions)(req, ...params);
}
