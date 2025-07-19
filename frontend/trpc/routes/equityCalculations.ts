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
  if (equityPercentage !== 0 && !unvestedGrant) {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyContractor.companyId),
      columns: {
        fmvPerShareInUsd: true,
      },
    });
    if (company?.fmvPerShareInUsd) {
      sharePriceUsd = company.fmvPerShareInUsd;
    } else {
      Bugsnag.notify(`calculateInvoiceEquity: Error determining share price for CompanyWorker ${companyContractor.id}`);
      return null;
    }
  }

  let equityAmountInCents = Decimal.mul(serviceAmountCents, equityPercentage).div(100).round().toNumber();
  let equityAmountInOptions = 0;

  if (equityPercentage !== 0 && sharePriceUsd !== 0) {
    equityAmountInOptions = Decimal.div(equityAmountInCents, Decimal.mul(sharePriceUsd, 100)).round().toNumber();
  }

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
