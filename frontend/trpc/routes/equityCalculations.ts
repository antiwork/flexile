import { TRPCError } from "@trpc/server";
import { Decimal } from "decimal.js";
import { z } from "zod";
import { companyContractors } from "@/db/schema";
import { type CompanyContext, companyProcedure, createRouter } from "@/trpc";
import { getUniqueUnvestedEquityGrantForYear } from "@/trpc/routes/equityGrants";

// If you make changes here, update the ruby class InvoiceEquityCalculator
export const calculateInvoiceEquity = async ({
  ctx,
  companyContractor,
  serviceAmountCents,
  invoiceYear,
  providedEquityPercentage,
}: {
  ctx: CompanyContext;
  companyContractor: typeof companyContractors.$inferSelect;
  serviceAmountCents: number;
  invoiceYear: number;
  providedEquityPercentage?: number;
}) => {
  if (!ctx.company.equityEnabled) return null;

  const unvestedGrant = await getUniqueUnvestedEquityGrantForYear(companyContractor, invoiceYear);
  const sharePriceUsd = unvestedGrant?.sharePriceUsd ?? ctx.company.fmvPerShareInUsd;
  if (!sharePriceUsd) return null;

  let equityPercentage = providedEquityPercentage ?? companyContractor.equityPercentage;
  let equityAmountInCents = Decimal.mul(serviceAmountCents, equityPercentage).div(100).round().toNumber();
  let equityAmountInOptions = Decimal.div(equityAmountInCents, Decimal.mul(sharePriceUsd, 100)).round().toNumber();

  if (equityAmountInOptions <= 0) {
    equityPercentage = 0;
    equityAmountInCents = 0;
    equityAmountInOptions = 0;
  }

  return {
    equityCents: equityAmountInCents,
    equityOptions: equityAmountInOptions,
    equityPercentage,
  };
};

export const equityCalculationsRouter = createRouter({
  calculate: companyProcedure
    .input(
      z.object({
        servicesInCents: z.number(),
        invoiceYear: z
          .number()
          .optional()
          .default(() => new Date().getFullYear()),
        selectedPercentage: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.companyContractor) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await calculateInvoiceEquity({
        ctx,
        companyContractor: ctx.companyContractor,
        serviceAmountCents: input.servicesInCents,
        invoiceYear: input.invoiceYear,
        ...(input.selectedPercentage ? { providedEquityPercentage: input.selectedPercentage } : {}),
      });

      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Something went wrong. Please contact the company administrator.",
        });
      }

      return result;
    }),
});
