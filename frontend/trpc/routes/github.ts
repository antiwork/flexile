import { TRPCError } from "@trpc/server";
import { z } from "zod";
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

export const githubRouter = createRouter({
  getUserConnection: protectedProcedure.query(
    (): GitHubConnection =>
      // TODO: This will need to be implemented with actual database queries
      // once the backend schema is set up. For now, return a mock response.
      ({
        connected: false,
        username: null,
        avatarUrl: null,
      }),
  ),

  getCompanyConnection: companyProcedure.query(({ ctx }): GitHubOrganization => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // TODO: This will need to be implemented with actual database queries
    // once the backend schema is set up. For now, return a mock response.
    return {
      connected: false,
      organizationName: null,
      organizationAvatarUrl: null,
    };
  }),

  connectUser: protectedProcedure.input(z.object({ code: z.string() })).mutation(() => {
    // TODO: This will need to be implemented with actual OAuth flow
    // once the backend is set up. For now, throw an error.
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "GitHub user connection is not yet implemented",
    });
  }),

  disconnectUser: protectedProcedure.mutation(() => {
    // TODO: This will need to be implemented with actual database operations
    // once the backend schema is set up. For now, throw an error.
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "GitHub user disconnection is not yet implemented",
    });
  }),

  connectCompany: companyProcedure.input(z.object({ code: z.string() })).mutation(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // TODO: This will need to be implemented with actual OAuth flow
    // once the backend is set up. For now, throw an error.
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "GitHub company connection is not yet implemented",
    });
  }),

  disconnectCompany: companyProcedure.mutation(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // TODO: This will need to be implemented with actual database operations
    // once the backend schema is set up. For now, throw an error.
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "GitHub company disconnection is not yet implemented",
    });
  }),

  getPullRequest: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
      }),
    )
    .query(({ input }): GitHubPullRequest => {
      // Parse the GitHub PR URL to extract owner, repo, and PR number
      const prUrlPattern = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/u;
      const match = prUrlPattern.exec(input.url);

      if (!match) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid GitHub pull request URL",
        });
      }

      const [, owner, repo, prNumber] = match;

      // TODO: This will need to be implemented with actual GitHub API calls
      // once the backend is set up. For now, return a mock response.
      return {
        id: parseInt(prNumber ?? "0", 10),
        number: parseInt(prNumber ?? "0", 10),
        title: "Example Pull Request",
        state: "merged",
        merged: true,
        htmlUrl: input.url,
        repoOwner: owner ?? "",
        repoName: repo ?? "",
        authorLogin: null,
        authorAvatarUrl: null,
        createdAt: new Date().toISOString(),
        mergedAt: new Date().toISOString(),
        bountyAmount: null,
        isPaid: false,
      };
    }),

  checkPrPaidStatus: companyProcedure
    .input(
      z.object({
        prUrl: z.string().url(),
      }),
    )
    .query(({ ctx }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      // TODO: This will need to check if the PR has been paid in a previous invoice
      // once the backend schema is set up. For now, return false.
      const result: { isPaid: boolean; paidInvoiceId: string | null } = {
        isPaid: false,
        paidInvoiceId: null,
      };
      return result;
    }),
});
