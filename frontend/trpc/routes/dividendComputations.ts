import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_dividend_computations_url } from "@/utils/routes";

const dividendComputationSchema = z.array(
  z.object({
    id: z.number(),
    total_amount_in_usd: z.string(),
    dividends_issuance_date: z.string(),
    return_of_capital: z.boolean(),
    number_of_shareholders: z.number(),
  }),
);

export const dividendComputationsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    const response = await fetch(company_dividend_computations_url(ctx.company.externalId, { host: ctx.host }), {
      headers: { "Content-Type": "application/json", ...ctx.headers },
    });

    if (!response.ok) {
      const { error_message } = z.object({ error_message: z.string() }).parse(await response.json());
      throw new TRPCError({ code: "BAD_REQUEST", message: error_message });
    }

    return dividendComputationSchema.parse(await response.json());
  }),
});
