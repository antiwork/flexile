import { z } from "zod";
import env from "@/env";
import { createRouter, protectedProcedure } from "@/trpc";

// GitHub PR data returned from backend
export interface GitHubPRData {
  number: number;
  title: string;
  author: string;
  merged_at: string | null;
  state: string;
  url: string;
  repo: string;
  bounty_cents: number | null;
  already_paid: boolean;
  belongs_to_company_org: boolean;
  user_github_connected: boolean;
  verified: boolean;
}

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
    const data = (await response.json()) as { oauth_url: string };
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
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "OAuth failed");
      }

      return (await response.json()) as { success: boolean; github_username: string };
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
    const response = await fetch(
      `${getApiBaseUrl()}/internal/github/fetch_pr?url=${encodeURIComponent(input.url)}`,
      { headers: ctx.headers },
    );

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error ?? "Could not fetch PR");
    }

    const data = (await response.json()) as GitHubPRData;

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
