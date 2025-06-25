import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_contractor_invite_link_url, reset_company_contractor_invite_link_url } from "@/utils/routes";

export const contractorInviteLinksRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const frontendHost = `${ctx.headers["x-forwarded-proto"] || "https"}://${ctx.host}`;

    const response = await fetch(company_contractor_invite_link_url(ctx.company.externalId, { host: ctx.host }), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Frontend-Host": frontendHost,
        ...ctx.headers,
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
  }),

  reset: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const frontendHost = `${ctx.headers["x-forwarded-proto"] || "https"}://${ctx.host}`;

    const response = await fetch(reset_company_contractor_invite_link_url(ctx.company.externalId, { host: ctx.host }), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frontend-Host": frontendHost,
        ...ctx.headers,
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
  }),
});
