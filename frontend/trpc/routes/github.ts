import { TRPCError } from "@trpc/server";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, invoiceLineItems, invoices } from "@/db/schema";
import { companyProcedure, createRouter, protectedProcedure } from "@/trpc";

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  merged: boolean;
  htmlUrl: string;
  repoOwner: string;
  repoName: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  mergedAt: string | null;
  bountyAmount: number | null;
  isPaid: boolean;
}

interface GitHubConnection {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
}

interface GitHubOrganization {
  connected: boolean;
  organizationName: string | null;
  organizationAvatarUrl: string | null;
}

const GITHUB_API_BASE = "https://api.github.com";

const parseBountyFromLabels = (labels: { name: string }[]): number | null => {
  for (const label of labels) {
    const match = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/u.exec(label.name);
    if (match?.[1]) {
      return Math.round(parseFloat(match[1].replace(/,/gu, "")) * 100);
    }
  }
  return null;
};

const parseGitHubPrUrl = (url: string): { owner: string; repo: string; prNumber: number } | null => {
  const prUrlPattern = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/u;
  const match = prUrlPattern.exec(url);
  if (!match) return null;
  const [, owner, repo, prNumber] = match;
  if (!owner || !repo || !prNumber) return null;
  return { owner, repo, prNumber: parseInt(prNumber, 10) };
};

const gitHubPrResponseSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.string(),
  merged: z.boolean(),
  html_url: z.string(),
  user: z.object({ login: z.string(), avatar_url: z.string() }).nullable(),
  created_at: z.string(),
  merged_at: z.string().nullable(),
  labels: z.array(z.object({ name: z.string() })),
});

const fetchGitHubPR = async (owner: string, repo: string, prNumber: number): Promise<GitHubPullRequest | null> => {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Flexile-App",
      },
    });

    if (!response.ok) {
      return null;
    }

    const parseResult = gitHubPrResponseSchema.safeParse(await response.json());
    if (!parseResult.success) {
      return null;
    }

    const data = parseResult.data;
    const prState = data.merged ? "merged" : data.state === "open" ? "open" : "closed";

    return {
      id: data.id,
      number: data.number,
      title: data.title,
      state: prState,
      merged: data.merged,
      htmlUrl: data.html_url,
      repoOwner: owner,
      repoName: repo,
      authorLogin: data.user?.login ?? null,
      authorAvatarUrl: data.user?.avatar_url ?? null,
      createdAt: data.created_at,
      mergedAt: data.merged_at,
      bountyAmount: parseBountyFromLabels(data.labels),
      isPaid: false,
    };
  } catch {
    return null;
  }
};

export const githubRouter = createRouter({
  getUserConnection: protectedProcedure.query(
    (): GitHubConnection => ({
      connected: false,
      username: null,
      avatarUrl: null,
    }),
  ),

  getCompanyConnection: companyProcedure.query(({ ctx }): GitHubOrganization => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const githubOrg = ctx.company.jsonData.githubOrganization;

    if (!githubOrg) {
      return {
        connected: false,
        organizationName: null,
        organizationAvatarUrl: null,
      };
    }

    return {
      connected: true,
      organizationName: githubOrg,
      organizationAvatarUrl: `https://github.com/${githubOrg}.png`,
    };
  }),

  connectCompany: companyProcedure
    .input(z.object({ organizationName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const response = await fetch(`${GITHUB_API_BASE}/orgs/${input.organizationName}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Flexile-App",
        },
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub organization not found. Please check the organization name.",
        });
      }

      await db
        .update(companies)
        .set({
          jsonData: {
            ...ctx.company.jsonData,
            githubOrganization: input.organizationName,
          },
        })
        .where(eq(companies.id, ctx.company.id));

      return { success: true };
    }),

  disconnectCompany: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const { githubOrganization: _githubOrganization, ...jsonData } = ctx.company.jsonData;
    await db.update(companies).set({ jsonData }).where(eq(companies.id, ctx.company.id));

    return { success: true };
  }),

  getPullRequest: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .query(async ({ input }): Promise<GitHubPullRequest | null> => {
      const parsed = parseGitHubPrUrl(input.url);
      if (!parsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid GitHub pull request URL",
        });
      }

      const pr = await fetchGitHubPR(parsed.owner, parsed.repo, parsed.prNumber);
      return pr;
    }),

  checkPrPaidStatus: companyProcedure.input(z.object({ prUrl: z.string().url() })).query(async ({ ctx, input }) => {
    const parsed = parseGitHubPrUrl(input.prUrl);
    if (!parsed) {
      return { isPaid: false, paidInvoiceId: null };
    }

    const normalizedUrl = `github.com/${parsed.owner}/${parsed.repo}/pull/${parsed.prNumber}`;

    const paidInvoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.companyId, ctx.company.id), eq(invoices.status, "paid")),
      with: {
        lineItems: {
          where: like(invoiceLineItems.description, `%${normalizedUrl}%`),
        },
      },
    });

    if (paidInvoice && paidInvoice.lineItems.length > 0) {
      return {
        isPaid: true,
        paidInvoiceId: paidInvoice.externalId,
      };
    }

    return { isPaid: false, paidInvoiceId: null };
  }),

  verifyPrOwnership: companyProcedure
    .input(z.object({ prUrl: z.string().url(), githubUsername: z.string() }))
    .query(async ({ ctx, input }) => {
      const parsed = parseGitHubPrUrl(input.prUrl);
      if (!parsed) {
        return { isOwner: false, belongsToOrg: false };
      }

      const pr = await fetchGitHubPR(parsed.owner, parsed.repo, parsed.prNumber);
      if (!pr) {
        return { isOwner: false, belongsToOrg: false };
      }

      const isOwner = pr.authorLogin?.toLowerCase() === input.githubUsername.toLowerCase();

      const githubOrg = ctx.company.jsonData.githubOrganization;
      const belongsToOrg = githubOrg?.toLowerCase() === parsed.owner.toLowerCase();

      return { isOwner, belongsToOrg };
    }),
});
