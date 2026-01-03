import { z } from "zod";
import env from "@/env";
import { createRouter, protectedProcedure } from "@/trpc";

// Response schemas for validation
const oauthUrlResponseSchema = z.object({
  oauth_url: z.string(),
});

const exchangeCodeResponseSchema = z.object({
  success: z.boolean(),
  github_username: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string().optional(),
});

const githubPRDataSchema = z.object({
  number: z.number(),
  title: z.string(),
  author: z.string(),
  merged_at: z.string().nullable(),
  state: z.string(),
  url: z.string(),
  repo: z.string(),
  bounty_cents: z.number().nullable(),
  already_paid: z.boolean(),
  belongs_to_company_org: z.boolean(),
  user_github_connected: z.boolean(),
  verified: z.boolean(),
});

// Transformed frontend-friendly version
export interface GitHubPRInfo {
  number: number;
  title: string;
  author: string;
  mergedAt: string | null;
  state: string;
  url: string;
  repo: string;
  bountyCents: number | null;
  alreadyPaid: boolean;
  belongsToCompanyOrg: boolean;
  userGithubConnected: boolean;
  verified: boolean;
}

const getApiBaseUrl = () => `${env.PROTOCOL}://${env.DOMAIN}`;

export const githubRouter = createRouter({
  // Get GitHub OAuth URL for connecting
  getOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const response = await fetch(`${getApiBaseUrl()}/internal/github/connect`, {
      method: "POST",
      headers: ctx.headers,
    });
    if (!response.ok) {
      throw new Error("Failed to get OAuth URL");
    }
    const data = oauthUrlResponseSchema.parse(await response.json());
    return { url: data.oauth_url };
  }),

  // Exchange OAuth code for access token
  exchangeCode: protectedProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(`${getApiBaseUrl()}/internal/github/callback`, {
        method: "POST",
        headers: {
          ...ctx.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: input.code, state: input.state }),
      });

      if (!response.ok) {
        const error = errorResponseSchema.parse(await response.json());
        throw new Error(error.error ?? "OAuth failed");
      }

      return exchangeCodeResponseSchema.parse(await response.json());
    }),

  // Disconnect GitHub account
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const response = await fetch(`${getApiBaseUrl()}/internal/github/disconnect`, {
      method: "DELETE",
      headers: ctx.headers,
    });
    if (!response.ok) {
      throw new Error("Failed to disconnect");
    }
    return { success: true };
  }),

  // Fetch PR details from backend (which calls GitHub API)
  fetchPr: protectedProcedure.input(z.object({ url: z.string() })).query(async ({ ctx, input }) => {
    const response = await fetch(`${getApiBaseUrl()}/internal/github/fetch_pr?url=${encodeURIComponent(input.url)}`, {
      headers: ctx.headers,
    });

    if (!response.ok) {
      const error = errorResponseSchema.parse(await response.json());
      throw new Error(error.error ?? "Could not fetch PR");
    }

    const data = githubPRDataSchema.parse(await response.json());

    // Transform snake_case to camelCase for frontend
    return {
      number: data.number,
      title: data.title,
      author: data.author,
      mergedAt: data.merged_at,
      state: data.state,
      url: data.url,
      repo: data.repo,
      bountyCents: data.bounty_cents,
      alreadyPaid: data.already_paid,
      belongsToCompanyOrg: data.belongs_to_company_org,
      userGithubConnected: data.user_github_connected,
      verified: data.verified,
    } satisfies GitHubPRInfo;
  }),
});
