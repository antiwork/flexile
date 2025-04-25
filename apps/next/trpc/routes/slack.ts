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
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URL,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!response.ok) throw new Error("Failed to get Slack access token");
  const data = await response.json();

  return {
    team_id: data.team?.id,
    bot_user_id: data.bot_user_id,
    access_token: data.access_token,
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

      const { team_id, bot_user_id, access_token } = await getSlackAccessToken(input.code);

      if (!team_id) throw new Error("Slack team ID not found in response");

      if (integration) {
        await db
          .update(integrations)
          .set({
            status: "active",
            configuration: {
              ...integration.configuration,
              ...{ team_id, bot_user_id: assertDefined(bot_user_id), access_token: assertDefined(access_token) },
            },
          })
          .where(eq(integrations.id, integration.id));
      } else {
        await db.insert(integrations).values({
          type: "SlackIntegration",
          accountId: team_id,
          companyId: ctx.company.id,
          status: "active",
          configuration: {
            team_id,
            bot_user_id: assertDefined(bot_user_id),
            access_token: assertDefined(access_token),
          },
        });
      }
    }),
  disconnect: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyIntegration(ctx.company.id);
    if (!integration?.configuration) throw new TRPCError({ code: "NOT_FOUND" });
    if (!("team_id" in integration.configuration)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Not a Slack integration" });
    }

    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${integration.configuration.access_token}`,
      },
    });

    await db
      .update(integrations)
      .set({ deletedAt: new Date(), status: "deleted" })
      .where(eq(integrations.id, integration.id));
  }),
});
