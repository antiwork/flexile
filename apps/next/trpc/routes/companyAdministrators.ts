import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const companyAdministratorsRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const administrators = await db.query.companyAdministrators.findMany({
      where: eq(companyAdministrators.companyId, ctx.company.id),
      columns: {
        externalId: true,
        boardMember: true,
      },
      with: { user: true },
    });
    return administrators.map((admin) => ({
      ...admin,
      id: admin.externalId,
      name: admin.user.legalName ?? admin.user.email,
    }));
  }),

  update: companyProcedure
    .input(createUpdateSchema(companyAdministrators).pick({ boardMember: true }).extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const [row] = await db
        .update(companyAdministrators)
        .set(pick(input, "boardMember"))
        .where(and(eq(companyAdministrators.externalId, input.id), eq(companyAdministrators.companyId, ctx.company.id)))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    }),
});
