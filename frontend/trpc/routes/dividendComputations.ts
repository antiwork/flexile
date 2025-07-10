import { z } from "zod";
import { createRouter, companyProcedure } from "@/trpc";
import {
  company_dividend_computations_url,
  company_dividend_computation_url,
  confirm_company_dividend_computation_url
} from "@/utils/routes";

export const dividendComputationsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    try {
      const response = await fetch(
        company_dividend_computations_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "GET",
          headers: { "Content-Type": "application/json", ...ctx.headers },
        }
      );

      if (!response.ok) {
        return [];
      }

      // Handle the Rails response format: { success: true, data: [...] }
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      // Return empty array if there's an error (like no data exists yet)
      return [];
    }
  }),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const response = await fetch(
        company_dividend_computation_url(ctx.company.externalId, input.id, { host: ctx.host }),
        {
          method: "GET",
          headers: { "Content-Type": "application/json", ...ctx.headers },
        }
      );

      if (!response.ok) {
        throw new Error("Dividend computation not found");
      }

      const result = await response.json();
      return result.data;
    }),

  create: companyProcedure
    .input(
      z.object({
        amount_in_usd: z.number().positive(),
        dividends_issuance_date: z.string(),
        return_of_capital: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const response = await fetch(
        company_dividend_computations_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ctx.headers },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create dividend computation");
      }

      const result = await response.json();
      return result.data;
    }),

  confirm: companyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const response = await fetch(
        confirm_company_dividend_computation_url(ctx.company.externalId, input.id, { host: ctx.host }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ctx.headers },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to confirm dividend computation");
      }

      const result = await response.json();
      return result.data;
    }),

  delete: companyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const response = await fetch(
        company_dividend_computation_url(ctx.company.externalId, input.id, { host: ctx.host }),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...ctx.headers },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete dividend computation");
      }

      return { success: true };
    }),
});
