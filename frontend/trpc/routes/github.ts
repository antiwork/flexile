import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter, userProcedure } from "@/trpc/init";

const GITHUB_API_BASE = "https://api.github.com";

// Parse GitHub PR URL to extract owner, repo, and PR number
function parseGitHubPrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]!, number: parseInt(match[3]!, 10) };
}

// Extract bounty amount from labels (e.g., "$100", "bounty:100")
function extractBountyFromLabels(labels: Array<{ name: string }>): number | null {
  for (const label of labels) {
    const name = label.name || "";
    // Match patterns like "$100", "$1,000"
    const dollarMatch = name.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (dollarMatch) {
      return Math.round(parseFloat(dollarMatch[1]!.replace(/,/g, "")) * 100);
    }
    // Match patterns like "bounty:100"
    const bountyMatch = name.match(/bounty[:\s]*(\d+)/i);
    if (bountyMatch) {
      return parseInt(bountyMatch[1]!, 10) * 100;
    }
  }
  return null;
}

export const githubRouter = createRouter({
  // Get GitHub OAuth URL for connecting
  getOAuthUrl: userProcedure.query(async ({ ctx }) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings/github/callback`;
    const scope = "read:user,repo";
    const state = crypto.randomUUID();

    // Store state in a cookie or session for CSRF protection
    return {
      url: `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`,
      state,
    };
  }),

  // Exchange OAuth code for access token and save user info
  exchangeCode: userProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Exchange code for access token
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: input.code,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to exchange authorization code" });
      }

      // Fetch user info from GitHub
      const userResponse = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Flexile-App",
        },
      });

      if (!userResponse.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to fetch GitHub user info" });
      }

      const userData = await userResponse.json();

      // TODO: Save to database via Rails API or directly
      // For now, return the data to be handled by the frontend
      return {
        success: true,
        githubUsername: userData.login,
        githubUid: userData.id.toString(),
      };
    }),

  // Disconnect GitHub account
  disconnect: userProcedure.mutation(async ({ ctx }) => {
    // TODO: Call Rails API to disconnect
    return { success: true };
  }),

  // Fetch PR details from GitHub
  fetchPr: userProcedure.input(z.object({ url: z.string() })).query(async ({ ctx, input }) => {
    const parsed = parseGitHubPrUrl(input.url);
    if (!parsed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid GitHub PR URL" });
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Flexile-App",
          // Add auth header if user has GitHub connected
          // Authorization: `Bearer ${ctx.user.githubAccessToken}`,
        },
      });

      if (!response.ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Could not fetch PR details" });
      }

      const pr = await response.json();
      const bountyCents = extractBountyFromLabels(pr.labels || []);

      return {
        number: pr.number,
        title: pr.title,
        author: pr.user?.login,
        mergedAt: pr.merged_at,
        state: pr.state,
        url: pr.html_url,
        repo: `${parsed.owner}/${parsed.repo}`,
        bountyCents,
        alreadyPaid: false, // TODO: Check database for paid PRs
        verified: false, // TODO: Check if current user authored the PR
      };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch PR" });
    }
  }),
});
