import { WebClient } from "@slack/web-api";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import env from "@/env";
import { type CompanyContext, companyProcedure, createRouter } from "@/trpc";
import { assertDefined } from "@/utils/assert";

const oauthState = (ctx: CompanyContext) => Buffer.from(`${ctx.company.id}:${ctx.company.name}`).toString("base64");
export const getSlackAccessToken = async (code: string) => {
  const client = new WebClient();
  const response = await client.oauth.v2.access({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URL,
  });

  if (!response.ok) {
    throw new Error(response.error || "Failed to get Slack access token");
  }

  return {
    teamId: response.team?.id,
    botUserId: response.bot_user_id,
    accessToken: response.access_token,
  };
};

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

    const params = new URLSearchParams({
      scope: env.SLACK_SCOPES,
      redirect_uri: env.SLACK_REDIRECT_URL,
      client_id: env.SLACK_CLIENT_ID,
      state: oauthState(ctx),
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }),

  connect: companyProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.state !== oauthState(ctx)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OAuth state" });

      const integration = await companyIntegration(ctx.company.id);

      const { teamId, botUserId, accessToken } = await getSlackAccessToken(input.code);

      if (!teamId) throw new Error("Slack team ID not found in response");

      if (integration) {
        await db
          .update(integrations)
          .set({
            status: "active",
            configuration: {
              ...integration.configuration,
              ...{ teamId, botUserId: assertDefined(botUserId), accessToken: assertDefined(accessToken) },
            },
          })
          .where(eq(integrations.id, integration.id));
      } else {
        await db.insert(integrations).values({
          type: "SlackIntegration",
          accountId: teamId,
          companyId: ctx.company.id,
          status: "active",
          configuration: { teamId, botUserId: assertDefined(botUserId), accessToken: assertDefined(accessToken) },
        });
      }
    }),
  disconnect: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyIntegration(ctx.company.id);
    if (!integration?.configuration) throw new TRPCError({ code: "NOT_FOUND" });
    if (!("teamId" in integration.configuration)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Not a Slack integration" });
    }

    const slack = new WebClient(integration.configuration.accessToken);
    await slack.auth.revoke({ token: integration.configuration.accessToken });

    await db
      .update(integrations)
      .set({ deletedAt: new Date(), status: "deleted" })
      .where(eq(integrations.id, integration.id));
  }),
});
