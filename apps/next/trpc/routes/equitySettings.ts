import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companyContractors, equityAllocations } from "@/db/schema";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import { companyProcedure, createRouter } from "@/trpc";

export const equitySettingsRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });
    assertPermissions(ctx.companyContractor);

    return { allocation: await getEquityAllocation(ctx.companyContractor.id) };
  }),

  update: companyProcedure
    .input(z.object({ equityPercentage: z.number().min(0).max(MAX_EQUITY_PERCENTAGE) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });
      assertPermissions(ctx.companyContractor);

      const equityAllocation = await getEquityAllocation(ctx.companyContractor.id);
      if (equityAllocation?.locked) throw new TRPCError({ code: "FORBIDDEN" });
      if (equityAllocation && equityAllocation.status !== "pending_confirmation")
        throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .insert(equityAllocations)
        .values({
          companyContractorId: ctx.companyContractor.id,
          year: new Date().getFullYear(),
          equityPercentage: input.equityPercentage,
          status: "pending_grant_creation",
          locked: true,
        })
        .onConflictDoUpdate({
          target: [equityAllocations.companyContractorId, equityAllocations.year],
          set: { equityPercentage: input.equityPercentage, status: "pending_grant_creation" },
        });
    }),
});

const assertPermissions = (contractor: typeof companyContractors.$inferSelect) => {
  if (contractor.endedAt && new Date() > contractor.endedAt) throw new TRPCError({ code: "FORBIDDEN" });
  if (contractor.onTrial) throw new TRPCError({ code: "FORBIDDEN" });
};

const getEquityAllocation = async (contractorId: bigint) =>
  await db.query.equityAllocations.findFirst({
    columns: { equityPercentage: true, locked: true, status: true },
    where: and(
      eq(equityAllocations.companyContractorId, contractorId),
      eq(equityAllocations.year, new Date().getFullYear()),
    ),
  });
