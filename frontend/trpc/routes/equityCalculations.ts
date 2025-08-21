import Bugsnag from "@bugsnag/js";
import { TRPCError } from "@trpc/server";
import { Decimal } from "decimal.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyContractors } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { getUniqueUnvestedEquityGrantForYear } from "@/trpc/routes/equityGrants";

// If you make changes here, update the ruby class InvoiceEquityCalculator
export const calculateInvoiceEquity = async ({
  companyContractor,
  serviceAmountCents,
  invoiceYear,
  providedEquityPercentage,
}: {
  companyContractor: typeof companyContractors.$inferSelect;
  serviceAmountCents: number;
  invoiceYear: number;
  providedEquityPercentage?: number;
}) => {
  let equityPercentage = providedEquityPercentage ?? companyContractor.equityPercentage;

  const unvestedGrant = await getUniqueUnvestedEquityGrantForYear(companyContractor, invoiceYear);
  let sharePriceUsd = unvestedGrant?.sharePriceUsd ?? 0;
  let equityEnabled = true;

  if (equityPercentage !== 0 && !unvestedGrant) {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyContractor.companyId),
      columns: {
        fmvPerShareInUsd: true,
        equityEnabled: true,
      },
    });
    equityEnabled = company?.equityEnabled ?? true;
    if (company?.fmvPerShareInUsd) {
      sharePriceUsd = company.fmvPerShareInUsd;
    } else {
      Bugsnag.notify(`calculateInvoiceEquity: Error determining share price for CompanyWorker ${companyContractor.id}`);
      return null;
    }
  } else {
    // We still need to check equity enabled even if we have a grant
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyContractor.companyId),
      columns: {
        equityEnabled: true,
      },
    });
    equityEnabled = company?.equityEnabled ?? true;
  }

  let equityAmountInCents = Decimal.mul(serviceAmountCents, equityPercentage).div(100).round().toNumber();
  let equityAmountInOptions = 0;

  if (equityPercentage !== 0 && equityEnabled && sharePriceUsd !== 0) {
    equityAmountInOptions = Decimal.div(equityAmountInCents, Decimal.mul(sharePriceUsd, 100)).round().toNumber();
  }

  // Don't wipe equity splits if there's no grant - return null to indicate grant creation required
  if (
    equityPercentage !== 0 &&
    (!unvestedGrant || (equityAmountInOptions > 0 && unvestedGrant.unvestedShares < equityAmountInOptions))
  ) {
    return null;
  }

  // Return indicator when equity percentage is too small to result in whole shares
  // This allows frontend to show notice suggesting user adjust to 0% or higher percentage
  if (equityPercentage !== 0 && equityEnabled && equityAmountInOptions <= 0) {
    const suggestedMinimumPercentage = Math.ceil(((Number(sharePriceUsd) * 100) / serviceAmountCents) * 100);
    return {
      equityPercentageTooSmall: true,
      suggestedMinimumPercentage,
      currentPercentage: equityPercentage,
    };
  }

  // When equity is disabled, set all equity values to zero
  if (!equityEnabled) {
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
        companyContractor: ctx.companyContractor,
        serviceAmountCents: input.servicesInCents,
        invoiceYear: input.invoiceYear,
        ...(input.selectedPercentage ? { providedEquityPercentage: input.selectedPercentage } : {}),
      });

      if (!result) {
        const hasEquityPercentage = ctx.companyContractor.equityPercentage > 0;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: hasEquityPercentage
            ? "Admin must create an equity grant before this can be processed."
            : "Something went wrong. Please contact the company administrator.",
        });
      }

      // Handle case where equity percentage is too small to result in whole shares
      if ("equityPercentageTooSmall" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your equity percentage (${result.currentPercentage}%) is too small to result in whole shares. Consider setting it to 0% or at least ${result.suggestedMinimumPercentage}% for this invoice amount.`,
        });
      }

      return result;
    }),
});
