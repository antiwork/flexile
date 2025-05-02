import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { expenseCategories } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const expenseCategoriesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    return await db.query.expenseCategories.findMany({
      where: eq(expenseCategories.companyId, ctx.company.id),
      columns: { id: true, name: true, expenseAccountId: true },
    });
  }),

  update: companyProcedure
    .input(z.object({ id: z.bigint(), expenseAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const [row] = await db
        .update(expenseCategories)
        .set({ expenseAccountId: input.expenseAccountId })
        .where(and(eq(expenseCategories.id, input.id), eq(expenseCategories.companyId, ctx.company.id)))
        .returning();

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    }),
});
