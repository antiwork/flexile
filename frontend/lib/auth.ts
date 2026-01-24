import Bugsnag from "@bugsnag/js";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider, { type GithubProfile } from "next-auth/providers/github";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import type { Provider } from "next-auth/providers/index";
import { z } from "zod";
import env from "@/env";
import { assertDefined } from "@/utils/assert";
import { oauth_index_path } from "@/utils/routes";

const otpLoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const isTestEnv = process.env.RAILS_ENV === "test" || process.env.NODE_ENV === "test";
const ExternalProvider = (provider: Provider) => {
  if (!isTestEnv) return provider;

  return CredentialsProvider({
    id: provider.id,
    name: provider.name,
    credentials: {
      email: { label: "Email", type: "email" },
    },
    authorize(credentials) {
      if (!credentials?.email) return null;

      const baseUser = {
        email: credentials.email,
        jwt: "test-jwt-token",
        id: "test-user-id",
        name: "Test User",
      };

      if (provider.id === "github") {
        return {
          ...baseUser,
          githubUsername: "github_dev_user",
          githubUid: "123456",
        };
      }
      return baseUser;
    },
  });
};

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
    ExternalProvider(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
    ),
    ExternalProvider(
      GithubProvider({
        clientId: env.GH_CLIENT_ID,
        clientSecret: env.GH_CLIENT_SECRET,
      }),
    ),
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
    async signIn({ user, account, profile }) {
      if (!account) return false;

      if (account.type !== "oauth" && !isTestEnv) return true;

      try {
        const isGithub = account.provider === "github";
        const isGoogle = account.provider === "google";

        let primaryEmailAddress = user.email;

        if (isGithub && account.access_token) {
          const res = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${account.access_token}` },
          });
          if (res.ok) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const emails = (await res.json()) as { email: string; verified: boolean; primary: boolean }[];
            const primaryEmail = emails.find((e) => e.primary && e.verified);
            if (!primaryEmail) {
              return false;
            }
            primaryEmailAddress = primaryEmail.email;
          } else {
            return false;
          }
        }

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        if (isGoogle && !(profile as GoogleProfile | undefined)?.email_verified) {
          return false;
        }

        let githubParams = {};

        if (isGithub) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const ghProfile = profile as GithubProfile | undefined;
          githubParams = {
            github_uid: account.providerAccountId || user.githubUid,
            github_username: ghProfile?.login || user.githubUsername,
          };
        }

        const response = await fetch(`${process.env.NEXTAUTH_URL}/${oauth_index_path()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: primaryEmailAddress,
            token: env.API_SECRET_TOKEN,
            provider: account.provider,
            ...githubParams,
          }),
        });

        if (!response.ok) {
          throw new Error(
            z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
              "Oauth failed, please try again.",
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
              github_uid: z.number().nullable().optional(),
              github_username: z.string().nullable().optional(),
            }),
            jwt: z.string(),
          })
          .parse(await response.json());

        user.jwt = data.jwt;
        user.legalName = data.user.legal_name ?? "";
        user.preferredName = data.user.preferred_name ?? "";

        if (isGithub) {
          user.githubUid = account.providerAccountId;

          if (isTestEnv) {
            user.githubUsername = "github_dev_user";
          } else {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            user.githubUsername = (profile as GithubProfile).login;
          }
        }
        return true;
      } catch (error) {
        Bugsnag.notify(
          `OAuth login failed: user ${user.id}, account_provider: ${account.provider}, error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;
