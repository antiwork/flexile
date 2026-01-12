import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { type GithubIntegrationConfiguration } from "@/db/json";
import { integrations, users } from "@/db/schema";
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
});
