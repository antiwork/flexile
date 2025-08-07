import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dividendComputationOutputs, dividendComputations } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const dividendComputationsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    return await db
      .select({
        id: dividendComputations.id,
        companyId: dividendComputations.companyId,
        totalAmountInUsd: dividendComputations.totalAmountInUsd,
        dividendsIssuanceDate: dividendComputations.dividendsIssuanceDate,
        returnOfCapital: dividendComputations.returnOfCapital,
        numberOfShareholders: sql<number>`
          COUNT(DISTINCT ${dividendComputationOutputs.companyInvestorId})
        `,
      })
      .from(dividendComputations)
      .leftJoin(
        dividendComputationOutputs,
        eq(dividendComputations.id, dividendComputationOutputs.dividendComputationId),
      )
      .where(eq(dividendComputations.companyId, ctx.company.id))
      .groupBy(dividendComputations.id)
      .orderBy(desc(dividendComputations.id));
  }),
});
