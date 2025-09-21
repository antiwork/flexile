import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_investor_entity_url } from "@/utils/routes";

const grantSchema = z.object({
  issuedAt: z.string(),
  numberOfShares: z.number(),
  vestedShares: z.number(),
  unvestedShares: z.number(),
  exercisedShares: z.number(),
  vestedAmountUsd: z.number().nullable(),
  exercisePriceUsd: z.number(),
});

const shareSchema = z.object({
  issuedAt: z.string(),
  shareType: z.string(),
  numberOfShares: z.number(),
  sharePriceUsd: z.number(),
  totalAmountInCents: z.number(),
});

const investorEntityResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  grants: z.array(grantSchema),
  shares: z.array(shareSchema),
});

export const investorEntitiesRouter = createRouter({
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "NOT_FOUND" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_investor_entity_url(ctx.company.externalId, input.id), {
      headers: ctx.headers,
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch investor entity",
      });
    }

    return investorEntityResponseSchema.parse(await response.json());
  }),
});
