import Bugsnag from "@bugsnag/js";
import { TRPCError } from "@trpc/server";
import { Decimal } from "decimal.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, equityAllocations } from "@/db/schema";
import { type CompanyContext, companyProcedure, createRouter } from "@/trpc";
import { getUniqueUnvestedEquityGrantForYear } from "@/trpc/routes/equityGrants";

type CalculateEquityResult = {
  equityCents: number;
  equityOptions: number;
  selectedPercentage: number | null;
  equityPercentage: number;
  isEquityAllocationLocked: boolean | null;
} | null;

// If you make changes here, update the ruby class InvoiceEquityCalculator
export const calculateInvoiceEquity = async ({
  companyContractor,
  serviceAmountCents,
  invoiceYear,
  equityCompensationEnabled,
  providedEquityPercentage,
}: {
  companyContractor: CompanyContext["companyContractor"];
  serviceAmountCents: number | bigint;
  invoiceYear: number;
  equityCompensationEnabled: boolean;
  providedEquityPercentage?: number;
}): Promise<CalculateEquityResult> => {
  if (companyContractor === undefined) {
    Bugsnag.notify(`calculateInvoiceEquity: Company contractor not found for user`);
    return null;
  }
  let isEquityAllocationLocked = null;
  let selectedPercentage = null;
  let equityPercentage = 0;

  const serviceAmountCentsNumber =
    typeof serviceAmountCents === "bigint" ? Number(serviceAmountCents) : serviceAmountCents;

  // If providedEquityPercentage is given, use it directly
  if (providedEquityPercentage !== undefined) {
    equityPercentage = providedEquityPercentage;
    selectedPercentage = providedEquityPercentage;
  }
  // Otherwise, get equity percentage from database
  else if (equityCompensationEnabled) {
    const equityAllocation = await db.query.equityAllocations.findFirst({
      where: and(
        eq(equityAllocations.companyContractorId, companyContractor.id),
        eq(equityAllocations.year, invoiceYear),
      ),
    });
    isEquityAllocationLocked = equityAllocation?.locked ?? null;
    if (equityAllocation?.equityPercentage) {
      selectedPercentage = equityAllocation.equityPercentage;
      equityPercentage = equityAllocation.equityPercentage;
    } else {
      equityPercentage = 0;
    }
  }

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

  let equityAmountInCents = Decimal.mul(serviceAmountCentsNumber, equityPercentage).div(100).round().toNumber();
  let equityAmountInOptions = 0;

  if (equityPercentage !== 0 && unvestedGrant) {
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
    selectedPercentage,
    equityPercentage,
    isEquityAllocationLocked,
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
        equityCompensationEnabled: ctx.company.equityCompensationEnabled,
      });

      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Something went wrong. Please contact the company administrator.",
        });
      }

      return {
        amountInCents: result.equityCents,
        isEquityAllocationLocked: result.isEquityAllocationLocked,
        selectedPercentage: result.selectedPercentage,
      };
    }),
});
