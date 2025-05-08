import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { equityAllocations } from "@/db/schema";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import { companyProcedure, createRouter } from "@/trpc";

export const equitySettingsRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    return { allocation: await getEquityAllocation(ctx.companyContractor.id) };
  }),

  update: companyProcedure
    .input(z.object({ equityPercentage: z.number().min(0).max(MAX_EQUITY_PERCENTAGE), year: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

      const year = input.year ?? new Date().getFullYear();
      const equityAllocation = await getEquityAllocation(ctx.companyContractor.id, year);
      if (!ctx.company.equityCompensationEnabled) return;
      if (equityAllocation && equityAllocation.status !== "pending_confirmation" && equityAllocation.locked) return;

      if (!equityAllocation) {
        await db.insert(equityAllocations).values({
          companyContractorId: ctx.companyContractor.id,
          year,
          equityPercentage: input.equityPercentage,
          status: "pending_grant_creation",
          locked: true,
        });
      } else {
        const status =
          equityAllocation.status === "pending_confirmation" ? "pending_grant_creation" : equityAllocation.status;
        await db
          .update(equityAllocations)
          .set({ equityPercentage: input.equityPercentage, status, locked: true })
          .where(
            and(eq(equityAllocations.companyContractorId, ctx.companyContractor.id), eq(equityAllocations.year, year)),
          );
      }
    }),
});

const getEquityAllocation = async (contractorId: bigint, year: number = new Date().getFullYear()) =>
  await db.query.equityAllocations.findFirst({
    columns: { equityPercentage: true, locked: true, status: true },
    where: and(eq(equityAllocations.companyContractorId, contractorId), eq(equityAllocations.year, year)),
  });
