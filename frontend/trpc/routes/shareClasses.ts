import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shareClasses } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const shareClassesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    return await db.query.shareClasses.findMany({
      columns: { id: true, name: true },
      where: eq(shareClasses.companyId, ctx.company.id),
    });
  }),
});
