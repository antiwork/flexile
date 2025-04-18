import { TRPCError } from "@trpc/server";
import { and, desc, eq, sum } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { companyInvestors, shareClasses, shareHoldings } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const shareHoldingsRouter = createRouter({
  list: companyProcedure.input(z.object({ investorId: z.string() })).query(async ({ input, ctx }) => {
    if (
      !ctx.companyAdministrator &&
      !ctx.companyLawyer &&
      !(ctx.companyInvestor && ctx.companyInvestor.externalId === input.investorId)
    )
      throw new TRPCError({ code: "FORBIDDEN" });

    return await db
      .select({
        shareClassName: shareClasses.name,
        ...pick(shareHoldings, "numberOfShares", "sharePriceUsd", "totalAmountInCents", "issuedAt"),
      })
      .from(shareHoldings)
      .innerJoin(companyInvestors, eq(shareHoldings.companyInvestorId, companyInvestors.id))
      .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
      .where(and(eq(shareClasses.companyId, ctx.company.id), eq(companyInvestors.externalId, input.investorId)))
      .orderBy(desc(shareHoldings.id));
  }),
  sumByShareClass: companyProcedure
    .input(z.object({ investorId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      if (
        !ctx.companyAdministrator &&
        (!ctx.companyInvestor || (input.investorId && input.investorId !== ctx.companyInvestor.externalId))
      )
        throw new TRPCError({ code: "FORBIDDEN" });

      return await db
        .select({ className: shareClasses.name, count: sum(shareHoldings.numberOfShares).mapWith(Number) })
        .from(shareHoldings)
        .where(
          and(
            input.investorId
              ? eq(shareHoldings.companyInvestorId, byExternalId(companyInvestors, input.investorId))
              : undefined,
            eq(shareClasses.companyId, ctx.company.id),
          ),
        )
        .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
        .groupBy(shareClasses.name);
    }),
});
