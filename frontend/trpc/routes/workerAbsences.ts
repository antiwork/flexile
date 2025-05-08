import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { omit } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { companyContractorAbsences, companyContractors } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { assert } from "@/utils/assert";
import { isActive } from "./contractors";

export const workerAbsencesRouter = createRouter({
  list: companyProcedure
    .input(z.object({ contractorId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.companyAdministrator && !isActive(ctx.companyContractor)) throw new TRPCError({ code: "FORBIDDEN" });
      return await db.query.companyContractorAbsences.findMany({
        columns: { id: true, startsOn: true, endsOn: true, companyContractorId: true },
        where: and(
          eq(companyContractorAbsences.companyId, ctx.company.id),
          input.from ? gte(companyContractorAbsences.endsOn, input.from) : undefined,
          input.to ? lte(companyContractorAbsences.startsOn, input.to) : undefined,
          input.contractorId
            ? eq(companyContractorAbsences.companyContractorId, byExternalId(companyContractors, input.contractorId))
            : undefined,
        ),
        orderBy: asc(companyContractorAbsences.startsOn),
      });
    }),
  create: companyProcedure
    .input(createInsertSchema(companyContractorAbsences).pick({ startsOn: true, endsOn: true, notes: true }))
    .mutation(async ({ input, ctx }) => {
      if (!isActive(ctx.companyContractor)) throw new TRPCError({ code: "FORBIDDEN" });
      const [absence] = await db
        .insert(companyContractorAbsences)
        .values({
          companyId: ctx.company.id,
          companyContractorId: ctx.companyContractor.id,
          ...omit(input, "companyId"),
        })
        .returning();
      assert(absence != null);
      return absence.id;
    }),
  update: companyProcedure
    .input(
      createUpdateSchema(companyContractorAbsences)
        .pick({ startsOn: true, endsOn: true, notes: true })
        .extend({ id: z.bigint() }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!isActive(ctx.companyContractor)) throw new TRPCError({ code: "FORBIDDEN" });
      const [updated] = await db
        .update(companyContractorAbsences)
        .set(omit(input, "companyId", "id"))
        .where(
          and(
            eq(companyContractorAbsences.id, input.id),
            eq(companyContractorAbsences.companyContractorId, ctx.companyContractor.id),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
    }),
  delete: companyProcedure.input(z.object({ id: z.bigint() })).mutation(async ({ input, ctx }) => {
    if (!isActive(ctx.companyContractor)) throw new TRPCError({ code: "FORBIDDEN" });
    const [deleted] = await db
      .delete(companyContractorAbsences)
      .where(
        and(
          eq(companyContractorAbsences.id, input.id),
          eq(companyContractorAbsences.companyContractorId, ctx.companyContractor.id),
        ),
      )
      .returning();
    if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
  }),
});
