import { TRPCError } from "@trpc/server";
import { and, eq, isNull, neq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { type GithubIntegrationConfiguration } from "@/db/json";
import { integrations, invoiceLineItems, invoices, users } from "@/db/schema";
import { companyProcedure, createRouter, protectedProcedure } from "@/trpc";

const companyGithubIntegration = async (companyId: bigint) => {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.companyId, companyId),
      eq(integrations.type, "GithubIntegration"),
      isNull(integrations.deletedAt),
    ),
  });
  return integration;
};

export const githubRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    // Allow admins and contractors (to check if they need to connect)
    if (!ctx.companyAdministrator && !ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyGithubIntegration(ctx.company.id);
    if (!integration) return null;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const configuration = integration.configuration as GithubIntegrationConfiguration;

    return {
      id: integration.id,
      status: integration.status,
      organization: configuration.organization,
    };
  }),

  connect: companyProcedure.input(z.object({ organization: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyGithubIntegration(ctx.company.id);

    if (integration) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const configuration = (integration.configuration ?? {}) as GithubIntegrationConfiguration;
      await db
        .update(integrations)
        .set({
          status: "active",
          configuration: {
            ...configuration,
            organization: input.organization,
          },
        })
        .where(eq(integrations.id, integration.id));
    } else {
      await db.insert(integrations).values({
        type: "GithubIntegration",
        accountId: input.organization, // Using org name as accountId for now
        companyId: ctx.company.id,
        status: "active",
        configuration: {
          organization: input.organization,
        },
      });
    }
  }),

  disconnect: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyGithubIntegration(ctx.company.id);
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });

    await db
      .update(integrations)
      .set({ deletedAt: new Date(), status: "deleted" })
      .where(eq(integrations.id, integration.id));
  }),

  // User-level connection (for contractors)
  connectUser: protectedProcedure
    .input(z.object({ githubUsername: z.string(), githubExternalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(users)
        .set({
          githubUsername: input.githubUsername,
          githubExternalId: input.githubExternalId,
        })
        .where(eq(users.id, BigInt(ctx.userId)));
    }),

  disconnectUser: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(users)
      .set({
        githubUsername: null,
        githubExternalId: null,
      })
      .where(eq(users.id, BigInt(ctx.userId)));
  }),

  getPullRequest: protectedProcedure
    .input(z.object({ url: z.string().url(), invoiceId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Parse URL
      const match = input.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)$/u);
      if (!match) return null;

      const [, owner, repo, type, number] = match;
      const isPR = type === "pull";

      // Check if paid in our DB
      const paidLineItem = await db.query.invoiceLineItems.findFirst({
        where: and(
          eq(invoiceLineItems.description, input.url),
          input.invoiceId ? neq(invoiceLineItems.invoiceId, BigInt(input.invoiceId)) : undefined,
        ),
        with: {
          invoice: true,
        },
      });
      const isPaid = paidLineItem?.invoice?.status === "paid";

      const headers: HeadersInit = {
        Accept: "application/vnd.github.v3+json",
      };

      if (ctx.githubAccessToken) {
        headers.Authorization = `Bearer ${ctx.githubAccessToken}`;
      }

      try {
        const apiUrl = isPR
          ? `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`
          : `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;

        const response = await fetch(apiUrl, { headers });
        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            // Might be private and user not connected or no access
            return { error: "not_found_or_private", owner, repo, number, isPaid, type };
          }
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const data = (await response.json()) as {
          id: number;
          title: string;
          state: string;
          merged?: boolean;
          html_url: string;
          number: number;
          labels?: { name: string }[];
          user: { login: string };
        };

        // Check for bounty labels
        // Assuming labels like "bounty: $100" or similar
        const bountyLabel = data.labels?.find((l) => l.name.toLowerCase().includes("bounty"));
        let bountyAmount = null;
        if (bountyLabel) {
          const amountMatch = bountyLabel.name.match(/\$?(\d+)/u);
          if (amountMatch) {
            bountyAmount = parseInt(amountMatch[1], 10);
          }
        }

        // Check verification status
        let isVerified = null;
        let expectedGithubUsername: string | null = null;

        if (input.invoiceId) {
          const invoice = await db.query.invoices.findFirst({
            where: eq(invoices.id, BigInt(input.invoiceId)),
            with: {
              contractor: {
                with: {
                  user: true,
                },
              },
            },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
          expectedGithubUsername = (invoice as any)?.contractor?.user?.githubUsername;
        } else {
          // If no invoiceId, use current user as they are likely the ones creating/editing
          const user = await db.query.users.findFirst({
            where: eq(users.id, BigInt(ctx.userId)),
          });
          expectedGithubUsername = user?.githubUsername ?? null;
        }

        if (expectedGithubUsername) {
          isVerified = data.user.login.toLowerCase() === expectedGithubUsername.toLowerCase();
        }

        return {
          id: data.id,
          title: data.title,
          state: data.state,
          merged: data.merged || false,
          html_url: data.html_url,
          number: data.number,
          owner,
          repo,
          bountyAmount,
          author: data.user.login,
          isPaid,
          isVerified,
          type,
        };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch PR/Issue", e);
        return null;
      }
    }),
});
