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
  calculationData: companyProcedure
    .input(
      z.object({
        invoiceYear: z
          .number()
          .optional()
          .default(() => new Date().getFullYear()),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.companyContractor) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const equityPercentage = ctx.companyContractor.equityPercentage;

      const unvestedGrant = await getUniqueUnvestedEquityGrantForYear(ctx.companyContractor, input.invoiceYear);
      let sharePriceUsd = unvestedGrant?.sharePriceUsd ?? 0;

      if (equityPercentage !== 0 && !unvestedGrant) {
        const company = await db.query.companies.findFirst({
          where: eq(companies.id, ctx.companyContractor.companyId),
          columns: {
            fmvPerShareInUsd: true,
          },
        });
        if (company?.fmvPerShareInUsd) {
          sharePriceUsd = Number(company.fmvPerShareInUsd);
        } else {
          Bugsnag.notify(
            `calculationData: Error determining share price for CompanyWorker ${ctx.companyContractor.id}`,
          );
          return null;
        }
      }

      return {
        equityPercentage,
        sharePriceUsd: Number(sharePriceUsd),
      };
    }),
});
