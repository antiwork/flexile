import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, userProcedure } from "@/trpc/init";
import { request } from "@/utils/request";

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

export const githubRouter = createRouter({
  // Get GitHub OAuth URL for connecting
  getOAuthUrl: userProcedure.query(async () => {
    const response = await request("/internal/github/connect", { method: "POST" });
    if (!response.ok) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get OAuth URL" });
    }
    const data = await response.json();
    return { url: data.oauth_url };
  }),

  // Exchange OAuth code for access token
  exchangeCode: userProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ input }) => {
      const response = await request("/internal/github/callback", {
        method: "POST",
        body: JSON.stringify({ code: input.code, state: input.state }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new TRPCError({ code: "BAD_REQUEST", message: error.error || "OAuth failed" });
      }

      return response.json();
    }),

  // Disconnect GitHub account
  disconnect: userProcedure.mutation(async () => {
    const response = await request("/internal/github/disconnect", { method: "DELETE" });
    if (!response.ok) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to disconnect" });
    }
    return { success: true };
  }),

  // Fetch PR details from backend (which calls GitHub API)
  fetchPr: userProcedure.input(z.object({ url: z.string() })).query(async ({ input }) => {
    const response = await request(`/internal/github/fetch_pr?url=${encodeURIComponent(input.url)}`);

    if (!response.ok) {
      const error = await response.json();
      throw new TRPCError({
        code: response.status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
        message: error.error || "Could not fetch PR",
      });
    }

    const data: GitHubPRData = await response.json();

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
    };
  }),
});
