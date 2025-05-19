import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { companyInvestors, users } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const investorsRouter = createRouter({
  get: companyProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });
    const investor = await db.query.companyInvestors.findFirst({
      where: and(
        eq(companyInvestors.companyId, ctx.company.id),
        eq(companyInvestors.userId, byExternalId(users, input.userId)),
      ),
    });
    if (!investor) throw new TRPCError({ code: "NOT_FOUND" });
    return { id: investor.externalId };
  }),
});
