import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
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
        name: dividendComputations.name,
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
  getOutputs: companyProcedure.input(z.object({ id: z.bigint() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const computation = await db
      .select()
      .from(dividendComputations)
      .where(eq(dividendComputations.id, input.id) && eq(dividendComputations.companyId, ctx.company.id))
      .limit(1);

    if (!computation.length) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const outputs = await db.query.dividendComputationOutputs.findMany({
      with: {
        companyInvestor: { with: { user: { columns: { externalId: true, legalName: true } } } },
      },
      where: eq(dividendComputationOutputs.dividendComputationId, input.id),
      orderBy: [desc(dividendComputationOutputs.totalAmountInUsd)],
    });

    return outputs;
  }),
});
