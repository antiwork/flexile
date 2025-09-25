import { TRPCError } from "@trpc/server";
import { truncate } from "lodash-es";
import { z } from "zod";
import { companyProcedure, createRouter, renderTiptapToText } from "@/trpc";
import { isActive } from "@/trpc/routes/contractors";
import { company_company_update_url, company_company_updates_url } from "@/utils/routes";

const updateSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  sent_at: z.string().nullable().optional(),
  status: z.string(),
  sender_name: z.string().optional(),
});

const updatesListSchema = z.object({
  updates: z.array(updateSchema),
  pagy: z
    .object({
      page: z.number().optional(),
      pages: z.number().optional(),
      count: z.number().optional(),
    })
    .optional(),
});

export const companyUpdatesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const response = await fetch(company_company_updates_url(ctx.company.externalId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch company updates",
      });
    }

    const result = updatesListSchema.parse(await response.json());

    return {
      ...result,
      updates: result.updates.map((update) => ({
        ...update,
        summary: truncate(renderTiptapToText(update.body), { length: 300 }),
        sentAt: update.sent_at,
      })),
    };
  }),
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const response = await fetch(company_company_update_url(ctx.company.externalId, input.id), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch company update",
      });
    }

    const result = updateSchema.parse(await response.json());
    return {
      ...result,
      senderName: result.sender_name,
      sentAt: result.sent_at,
    };
  }),
});
