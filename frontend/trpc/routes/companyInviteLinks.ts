import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseProcedure, companyProcedure, createRouter } from "@/trpc";
import {
  company_invite_links_url,
  reset_company_invite_links_url,
  accept_invite_links_url,
  verify_invite_links_url,
  complete_onboarding_company_invite_links_url,
} from "@/utils/routes";

import { PayRateType } from "@/db/enums";

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

  completeOnboarding: companyProcedure
    .input(
      z.object({
        startedAt: z.string(),
        payRateInSubunits: z.number(),
        payRateType: z.nativeEnum(PayRateType),
        hoursPerWeek: z.number().nullable(),
        role: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });
      const url = complete_onboarding_company_invite_links_url(ctx.company.externalId, { host: ctx.host });
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({
          started_at: input.startedAt,
          pay_rate_in_subunits: input.payRateInSubunits,
          pay_rate_type: input.payRateType,
          hours_per_week: input.hoursPerWeek,
          role: input.role,
        }),
        headers: { "Content-Type": "application/json", ...ctx.headers },
      });
      if (!response.ok) {
        const error = z.object({ error_message: z.string(), success: z.boolean() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: error.error_message });
      }
      return await response.json();
    }),

  accept: baseProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    const response = await fetch(accept_invite_links_url({ host: ctx.host }), {
      method: "POST",
      body: JSON.stringify({ token: input.token }),
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });
    if (!response.ok) {
      const json = z.object({ error: z.string() }).parse(await response.json());
      throw new TRPCError({ code: "BAD_REQUEST", message: json.error });
    }

    const data = await response.json();
    return data.company_worker_id;
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
