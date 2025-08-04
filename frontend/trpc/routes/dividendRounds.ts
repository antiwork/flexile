import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { dividendRounds, dividends } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const dividendRoundsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const where = eq(dividendRounds.companyId, ctx.company.id);

    const result = await db
      .select({
        id: dividendRounds.id,
        companyId: dividendRounds.companyId,
        issuedAt: dividendRounds.issuedAt,
        numberOfShareholders: dividendRounds.numberOfShareholders,
        totalAmountInCents: dividendRounds.totalAmountInCents,
        returnOfCapital: dividendRounds.returnOfCapital,
        readyForPayment: dividendRounds.readyForPayment,
        status: sql<string>`
        CASE
          WHEN ${dividendRounds.status} = ${"Paid"} THEN ${"COMPLETED"}
          WHEN COUNT(CASE WHEN ${dividends.status} = ${"Paid"} THEN 1 END) > 0 THEN ${"PARTIALLY_COMPLETED"}
          WHEN ${dividendRounds.readyForPayment} = false THEN ${"PAYMENT_SCHEDULED"}
          WHEN ${dividendRounds.readyForPayment} = true THEN ${"PAYMENT_IN_PROGRESS"}
          ELSE ${dividendRounds.status}
        END
      `.as("status"),
      })
      .from(dividendRounds)
      .leftJoin(dividends, eq(dividends.dividendRoundId, dividendRounds.id))
      .where(where)
      .groupBy(dividendRounds.id, dividendRounds.readyForPayment, dividendRounds.status)
      .orderBy(desc(dividendRounds.id));

    return result;
  }),

  get: companyProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const dividendRound = await db.query.dividendRounds.findFirst({
      columns: { issuedAt: true, totalAmountInCents: true, numberOfShareholders: true },
      where: and(eq(dividendRounds.id, BigInt(input.id)), eq(dividendRounds.companyId, ctx.company.id)),
    });
    if (!dividendRound) throw new TRPCError({ code: "NOT_FOUND" });

    return dividendRound;
  }),
});
