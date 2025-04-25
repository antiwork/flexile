import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { slackInstallProvider } from "@/lib/slack";
import { type CompanyContext, companyProcedure, createRouter } from "@/trpc";

const oauthState = (ctx: CompanyContext) => Buffer.from(`${ctx.company.id}:${ctx.company.name}`).toString("base64");

const companyIntegration = async (companyId: bigint) => {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.companyId, companyId),
      eq(integrations.type, "SlackIntegration"),
      isNull(integrations.deletedAt),
    ),
  });
  if (!integration) return null;
  return { ...integration, configuration: integration.configuration };
};

export const slackRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    const integration = await companyIntegration(ctx.company.id);
    return integration ? { status: integration.status } : null;
  }),

  getAuthUrl: companyProcedure.query(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return getSlackAuthUrl(oauthState(ctx));
  }),

  connect: companyProcedure
    .input(z.object({ companyId: z.bigint(), code: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.state !== oauthState(ctx)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OAuth state" });

      const integration = await companyIntegration(ctx.company.id);

      const { tokenConfig } = await getSlackTokenConfiguration(input.code);

      if (integration) {
        await db
          .update(integrations)
          .set({
            status: "active",
            configuration: {
              ...integration.configuration,
              ...tokenConfig,
            },
          })
          .where(eq(integrations.id, integration.id));
      } else {
        await db.insert(integrations).values({
          type: "SlackIntegration",
          accountId: tokenConfig.team_id,
          companyId: ctx.company.id,
          status: "active",
          configuration: {
            ...tokenConfig,
          },
        });
      }
    }),
  disconnect: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyIntegration(ctx.company.id);
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });

    const slack = getSlackClient(integration);
    await slack.revokeAccess();

    await db
      .update(integrations)
      .set({ deletedAt: new Date(), status: "deleted" })
      .where(eq(integrations.id, integration.id));
  }),
});
