import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { equityAllocations } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { MAX_EQUITY_PERCENTAGE } from "@/models";

export const equityAllocationsRouter = createRouter({
  get: companyProcedure.input(z.object({ year: z.number() })).query(async ({ ctx, input }) => {
    if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const result = await db.query.equityAllocations.findFirst({
      columns: { equityPercentage: true, locked: true },
      where: and(
        eq(equityAllocations.year, input.year),
        eq(equityAllocations.companyContractorId, ctx.companyContractor.id),
      ),
    });

    return result ?? null;
  }),

  update: companyProcedure
    .input(z.object({ equityPercentage: z.number().min(0).max(MAX_EQUITY_PERCENTAGE), year: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .insert(equityAllocations)
        .values({
          companyContractorId: ctx.companyContractor.id,
          year: input.year ?? new Date().getFullYear(),
          equityPercentage: input.equityPercentage,
          locked: true,
        })
        .onConflictDoUpdate({
          target: [equityAllocations.companyContractorId, equityAllocations.year],
          set: { equityPercentage: input.equityPercentage, locked: true },
        });
    }),
});
