import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { companyInvestors, equityGrantExercises } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const equityGrantExercisesRouter = createRouter({
  list: companyProcedure.input(z.object({ investorId: z.string().optional() })).query(async ({ input, ctx }) => {
    if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });
    return await db.query.equityGrantExercises.findMany({
      columns: { id: true, requestedAt: true, numberOfOptions: true, totalCostCents: true, status: true },
      where: and(
        eq(equityGrantExercises.companyId, ctx.company.id),
        ne(equityGrantExercises.status, "pending"),
        input.investorId
          ? eq(equityGrantExercises.companyInvestorId, byExternalId(companyInvestors, input.investorId))
          : undefined,
      ),
    });
  }),
});
