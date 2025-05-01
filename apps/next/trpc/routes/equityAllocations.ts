import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { equityAllocations } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const equityAllocationsRouter = createRouter({
  forYear: companyProcedure.input(z.object({ year: z.number() })).query(async ({ ctx, input }) => {
    if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const result = await db.query.equityAllocations.findFirst({
      columns: { equityPercentage: true, locked: true, status: true },
      where: and(
        eq(equityAllocations.year, input.year),
        eq(equityAllocations.companyContractorId, ctx.companyContractor.id),
      ),
    });

    return result ?? null;
  }),
});
