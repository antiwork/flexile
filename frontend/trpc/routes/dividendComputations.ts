import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { dividendComputations } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const dividendComputationsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const where = eq(dividendComputations.companyId, ctx.company.id);
    return await db.query.dividendComputations.findMany({
      where,
      orderBy: [desc(dividendComputations.id)],
    });
  }),
});
