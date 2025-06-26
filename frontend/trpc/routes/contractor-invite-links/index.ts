import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_contractor_invite_link_url, reset_company_contractor_invite_link_url } from "@/utils/routes";

const makeContractorInviteLinkRequest = async (
  url: string,
  method: "GET" | "POST",
  ctx: {
    companyAdministrator: unknown;
    headers: Record<string, string | string[] | undefined>;
    host: string;
  },
) => {
  if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

  const forwardedProto = ctx.headers["x-forwarded-proto"];
  const frontendHost = `${Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https"}://${ctx.host}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Frontend-Host": frontendHost,
      ...Object.fromEntries(
        Object.entries(ctx.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value || ""]),
      ),
    },
  });

  if (!response.ok) {
    const json = z.object({ error: z.string() }).parse(await response.json());
    throw new TRPCError({ code: "BAD_REQUEST", message: json.error });
  }

  const data = z
    .object({
      id: z.string(),
      uuid: z.string(),
      url: z.string(),
      created_at: z.string(),
      user_id: z.string(),
      company_id: z.string(),
    })
    .parse(await response.json());

  return { ...data, createdAt: new Date(data.created_at) };
};

export const contractorInviteLinksRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) =>
    makeContractorInviteLinkRequest(
      company_contractor_invite_link_url(ctx.company.externalId, { host: ctx.host }),
      "GET",
      ctx,
    ),
  ),

  reset: companyProcedure.mutation(async ({ ctx }) =>
    makeContractorInviteLinkRequest(
      reset_company_contractor_invite_link_url(ctx.company.externalId, { host: ctx.host }),
      "POST",
      ctx,
    ),
  ),
});
