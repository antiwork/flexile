import Bugsnag from "@bugsnag/js";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { OAuthApp, Octokit, RequestError } from "octokit";
import { z } from "zod";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import env from "@/env";
import { companyProcedure, createRouter } from "@/trpc";

const SEARCH_RESULTS_PER_PAGE = 5;
const SUPPORTED_RESOURCE_TYPES = ["issues", "pull"];

const oauthApp = new OAuthApp({
  clientId: env.GH_CLIENT_ID,
  clientSecret: env.GH_CLIENT_SECRET,
});

export const companyIntegration = (id: bigint) =>
  and(eq(integrations.companyId, id), eq(integrations.type, "GithubIntegration"), isNull(integrations.deletedAt));

export const githubRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await db.query.integrations.findFirst({
      columns: { status: true },
      where: companyIntegration(ctx.company.id),
    });
    return integration ?? null;
  }),

  connect: companyProcedure.input(z.object({ code: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const { authentication } = await oauthApp.createToken({
      code: input.code,
      redirectUrl: `https://${ctx.host}/oauth_redirect`,
    });

    if (!authentication.token) throw new TRPCError({ code: "NOT_FOUND" });

    const authenticatedOctokit = new Octokit({ auth: authentication.token });
    const { data: userData } = await authenticatedOctokit.rest.users.getAuthenticated();
    const { data: memberships } = await authenticatedOctokit.rest.orgs.listMembershipsForAuthenticatedUser({
      state: "active",
    });

    const organizations = memberships
      .filter((membership) => membership.role === "admin")
      .map((membership) => membership.organization.login);

    const webhooks = await Promise.all(
      organizations.map(async (organization) => {
        const { data: webhook } = await authenticatedOctokit.rest.orgs.createWebhook({
          org: organization,
          name: "web",
          config: {
            url: `https://${ctx.host}/webhooks/github`,
            secret: env.GH_WEBHOOK_SECRET,
            content_type: "json",
          },
          events: ["issues", "pull_request"],
          active: true,
        });
        return { id: webhook.id.toString(), organization };
      }),
    );

    const values = {
      status: "active",
      configuration: {
        organizations,
        access_token: authentication.token,
        webhooks,
      },
      accountId: userData.id.toString(),
    } as const;

    const [updated] = await db.update(integrations).set(values).where(companyIntegration(ctx.company.id)).returning();
    if (!updated) {
      await db.insert(integrations).values({
        ...values,
        type: "GithubIntegration",
        companyId: ctx.company.id,
      });
    }
  }),

  disconnect: companyProcedure.input(z.object({ companyId: z.string() })).mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await db.query.integrations.findFirst({ where: companyIntegration(ctx.company.id) });
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });
    if (!integration.configuration || !("organizations" in integration.configuration))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid GitHub configuration" });

    const octokit = new Octokit({ auth: integration.configuration.access_token });
    await Promise.all(
      integration.configuration.webhooks.map((webhook) =>
        octokit.rest.orgs
          .deleteWebhook({ org: webhook.organization, hook_id: Number(webhook.id) })
          .catch((error: unknown) => {
            if (!(error instanceof RequestError && error.status === 404)) throw error;
          }),
      ),
    );
    await oauthApp.deleteAuthorization({ token: integration.configuration.access_token });

    await db
      .update(integrations)
      .set({
        deletedAt: new Date(),
        status: "deleted",
        configuration: { ...integration.configuration, webhooks: [] },
      })
      .where(eq(integrations.id, integration.id));
  }),

  search: companyProcedure.input(z.object({ query: z.string().nullable() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await db.query.integrations.findFirst({ where: companyIntegration(ctx.company.id) });
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });
    if (!integration.configuration || !("organizations" in integration.configuration))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid GitHub configuration" });

    const octokit = new Octokit({ auth: integration.configuration.access_token });

    const orgsFilter = integration.configuration.organizations.map((org) => `org:${org}`).join(" ");
    const searchQuery = `${input.query} in:title ${orgsFilter}`;

    const resources = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
      sort: "updated",
      order: "desc",
      per_page: SEARCH_RESULTS_PER_PAGE,
    });

    return resources.data.items.map(issueAndPullRequestPresenter);
  }),

  unfurl: companyProcedure.input(z.object({ url: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await db.query.integrations.findFirst({ where: companyIntegration(ctx.company.id) });
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });
    if (!integration.configuration || !("organizations" in integration.configuration))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid GitHub configuration" });

    try {
      const parsedUrl = new URL(input.url);
      if (!parsedUrl.host.endsWith("github.com")) return null;

      const [owner, repo, type, resourceId] = parsedUrl.pathname.split("/").filter(Boolean);
      if (owner === undefined || repo === undefined || type === undefined || resourceId === undefined) return null;
      if (!SUPPORTED_RESOURCE_TYPES.includes(type)) return null;

      const octokit = new Octokit({ auth: integration.configuration.access_token });

      const response = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: Number(resourceId),
      });
      const item = response.data;

      return issueAndPullRequestPresenter(item);
    } catch (_) {
      return null;
    }
  }),
});

type GetResultItem = Awaited<ReturnType<Octokit["rest"]["issues"]["get"]>>["data"];
type SearchResultItem = Awaited<
  ReturnType<Octokit["rest"]["search"]["issuesAndPullRequests"]>
>["data"]["items"][number];

const issueAndPullRequestPresenter = (item: SearchResultItem | GetResultItem) => ({
  external_id: item.node_id,
  description: item.title,
  resource_id: item.number.toString(),
  url: item.html_url,
  ...(item.pull_request
    ? ({
        resource_name: "pulls",
        status: item.pull_request.merged_at ? "merged" : item.draft ? "draft" : resourceStatusFor(item),
      } as const)
    : ({ resource_name: "issues", status: resourceStatusFor(item) } as const)),
});

export type IssueOrPullRequest = ReturnType<typeof issueAndPullRequestPresenter>;

const resourceStatusFor = (item: SearchResultItem | GetResultItem) => {
  if (item.state !== "open" && item.state !== "closed") {
    Bugsnag.notify(new Error(`Unknown GitHub item state: ${item.state}`));
    return "closed";
  }

  return item.state;
};
