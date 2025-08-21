import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { pick } from "lodash-es";
import { db } from "@/db";
import { dividendRounds } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const dividendRoundsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    const where = eq(dividendRounds.companyId, ctx.company.id);
    return await db
      .select({
        ...pick(
          dividendRounds,
          "issuedAt",
          "totalAmountInCents",
          "numberOfShareholders",
          "returnOfCapital",
          "readyForPayment",
          "status",
        ),
        id: dividendRounds.externalId,
      })
      .from(dividendRounds)
      .where(where)
      .orderBy(desc(dividendRounds.id));
  }),
});
