import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { optionPools } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const optionPoolsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityGrantsEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    return await db.query.optionPools.findMany({
      columns: { name: true, authorizedShares: true, issuedShares: true, availableShares: true },
      where: eq(optionPools.companyId, ctx.company.id),
      orderBy: [desc(optionPools.id)],
    });
  }),
});
