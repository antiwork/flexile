import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import {
  company_invite_links_url,
  reset_company_invite_links_url,
  accept_company_invite_links_url,
} from "@/utils/routes";

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

    return { invite_link: data.invite_link };
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

    return { invite_link: data.invite_link };
  }),

  verify: companyProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const response = await fetch(
      company_invite_links_url(ctx.company.externalId, { host: ctx.host }) +
        `/verify?token=${encodeURIComponent(input.token)}`,
      {
        method: "GET",
        headers: { ...ctx.headers },
      },
    );
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to verify invite link" });
    }
    const data = await response.json();
    return data; // { valid: boolean, ... }
  }),
});
