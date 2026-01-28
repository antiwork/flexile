import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { companyGithubConnections, users } from "@/db/schema";
import { fetch_github_pull_requests_url } from "@/utils/routes";
import { companyProcedure, createRouter, protectedProcedure } from "../";

export const githubRouter = createRouter({
  getCompanyConnection: companyProcedure.query(async ({ ctx }) => {
    const connection = await ctx.db.query.companyGithubConnections.findFirst({
      where: and(eq(companyGithubConnections.companyId, ctx.company.id), isNull(companyGithubConnections.revokedAt)),
    });

    return connection || null;
  }),

  getUserConnection: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, BigInt(ctx.userId)),
      columns: {
        githubUsername: true,
      },
    });

    return user?.githubUsername || null;
  }),

  fetchPullRequest: companyProcedure
    .input(z.object({ url: z.string(), targetUsername: z.string().nullable().optional() }))
    .query(async ({ ctx, input }) => {
      const response = await fetch(fetch_github_pull_requests_url(), {
        method: "POST",
        headers: {
          ...ctx.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: input.url,
          company_id: ctx.company.externalId,
          target_username: input.targetUsername,
        }),
      });

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to fetch PR details");
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (await response.json()) as {
        success: boolean;
        pr: {
          title: string;
          number: number;
          state: string;
          merged: boolean;
          author: string;
          author_avatar: string;
          html_url: string;
          repository: string;
          created_at: string;
          merged_at: string | null;
          bounty_cents: number | null;
          verified_author: boolean | null;
          already_paid: boolean;
          paid_invoice_numbers: { invoice_number: string; external_id: string }[];
          belongs_to_company: boolean;
          needs_connection: boolean;
        };
      };
    }),
  disconnectUser: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(users)
      .set({
        githubUid: null,
        githubUsername: null,
      })
      .where(eq(users.id, BigInt(ctx.userId)));

    return { success: true };
  }),
});
