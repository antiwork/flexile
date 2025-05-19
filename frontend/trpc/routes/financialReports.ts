import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companyMonthlyFinancialReports } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const financialReportsRouter = createRouter({
  get: companyProcedure.input(z.object({ years: z.array(z.number()).optional() })).query(async ({ ctx, input }) => {
    const isActiveContractor = ctx.companyContractor && !ctx.companyContractor.endedAt;
    if (!ctx.companyAdministrator && !(ctx.companyInvestor || isActiveContractor)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await db.query.companyMonthlyFinancialReports.findMany({
      columns: { month: true, year: true, revenueCents: true, netIncomeCents: true },
      where: and(
        eq(companyMonthlyFinancialReports.companyId, ctx.company.id),
        input.years ? inArray(companyMonthlyFinancialReports.year, input.years) : undefined,
      ),
    });
  }),
});
