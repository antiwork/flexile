// TODO Remove this TRCP once we have moved away from DocumentTemplates table

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { PayRateType } from "@/db/enums";
import { companyContractors } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const companyInviteLinksRouter = createRouter({
  completeOnboarding: companyProcedure
    .input(
      z.object({
        startedAt: z.string(),
        payRateInSubunits: z.number(),
        payRateType: z.nativeEnum(PayRateType),
        role: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(companyContractors)
        .set({
          startedAt: new Date(input.startedAt),
          role: input.role,
          payRateInSubunits: input.payRateInSubunits,
          payRateType: input.payRateType,
        })
        .where(eq(companyContractors.id, ctx.companyContractor.id));
    }),
});
