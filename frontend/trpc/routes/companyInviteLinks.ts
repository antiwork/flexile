import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseProcedure, companyProcedure, createRouter, protectedProcedure } from "@/trpc";
import {
  company_invite_links_url,
  reset_company_invite_links_url,
  accept_company_invite_links_url,
  verify_invite_links_url,
} from "@/utils/routes";

type VerifyInviteLinkResult = {
  valid: boolean;
  inviter_name?: string;
  company_name?: string;
  company_id?: string;
  error?: string;
};

export const companyInviteLinksRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_invite_links_url(ctx.company.externalId, { host: ctx.host }), {
      method: "GET",
      headers: { ...ctx.headers },
    });
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to get invite link" });
    }
    const data = await response.json();

    return { invite_link: `${ctx.host}/invite/${data.invite_link}` };
  }),

  accept: companyProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    if (ctx.companyAdministrator || ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(accept_company_invite_links_url(ctx.company.externalId, { host: ctx.host }), {
      method: "POST",
      body: JSON.stringify({ token: input.token }),
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to accept invite link" });
    }

    const data = await response.json();
    return data.company_worker_id;
  }),

  reset: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(reset_company_invite_links_url(ctx.company.externalId, { host: ctx.host }), {
      method: "PATCH",
      headers: { ...ctx.headers },
    });
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to reset invite link" });
    }
    const data = await response.json();

    return { invite_link: `${ctx.host}/invite/${data.invite_link}` };
  }),

  verify: baseProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const url = verify_invite_links_url({ host: ctx.host });

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ token: input.token }),
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });

    if (!response.ok) {
      return { valid: false } as VerifyInviteLinkResult;
    }

    const result = await response.json();

    return result as VerifyInviteLinkResult;
  }),
});
