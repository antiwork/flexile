import { TRPCError } from "@trpc/server";
import { parseISO } from "date-fns";
import { and, desc, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick, truncate } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { companyMonthlyFinancialReports, companyUpdates } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { type CompanyContext, companyProcedure, createRouter, renderTiptapToText } from "@/trpc";
import { isActive } from "@/trpc/routes/contractors";
import { assertDefined } from "@/utils/assert";

const byId = (ctx: CompanyContext, id: string) =>
  and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id));

type Update = typeof companyUpdates.$inferSelect;
const dataSchema = createInsertSchema(companyUpdates).pick({
  title: true,
  body: true,
  videoUrl: true,
  period: true,
  periodStartedOn: true,
  showRevenue: true,
  showNetIncome: true,
});
export const companyUpdatesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (
      !ctx.company.companyUpdatesEnabled ||
      (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
    )
      throw new TRPCError({ code: "FORBIDDEN" });
    const where = and(
      eq(companyUpdates.companyId, ctx.company.id),
      ctx.companyAdministrator ? undefined : isNotNull(companyUpdates.sentAt),
    );
    const rows = await db.query.companyUpdates.findMany({
      where,
      orderBy: desc(companyUpdates.createdAt),
    });
    const updates = rows.map((update) => ({
      ...pick(update, ["title", "sentAt"]),
      id: update.externalId,
      summary: truncate(renderTiptapToText(update.body), { length: 300 }),
    }));
    return { updates };
  }),
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (
      !ctx.company.companyUpdatesEnabled ||
      (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
    )
      throw new TRPCError({ code: "FORBIDDEN" });
    const update = await db.query.companyUpdates.findFirst({ where: byId(ctx, input.id) });
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });
    const financialReports = await getFinancialReports(update);
    return {
      ...pick(update, [
        "title",
        "body",
        "videoUrl",
        "period",
        "periodStartedOn",
        "showRevenue",
        "showNetIncome",
        "sentAt",
      ]),
      financialReports,
      id: update.externalId,
    };
  }),
  create: companyProcedure.input(dataSchema.required()).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [update] = await db
      .insert(companyUpdates)
      .values({
        ...pick(input, ["title", "body", "videoUrl", "period", "periodStartedOn", "showRevenue", "showNetIncome"]),
        companyId: ctx.company.id,
      })
      .returning();
    return assertDefined(update).externalId;
  }),
  update: companyProcedure.input(dataSchema.extend({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const [update] = await db
      .update(companyUpdates)
      .set({
        ...pick(input, ["title", "body", "videoUrl", "period", "periodStartedOn", "showRevenue", "showNetIncome"]),
        companyId: ctx.company.id,
      })
      .where(byId(ctx, input.id))
      .returning();
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });
  }),
  publish: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [update] = await db
      .update(companyUpdates)
      .set({ sentAt: new Date() })
      .where(and(byId(ctx, input.id), isNull(companyUpdates.sentAt)))
      .returning();

    if (!update) throw new TRPCError({ code: "NOT_FOUND" });

    await inngest.send({
      name: "company.update.published",
      data: {
        updateId: update.externalId,
      },
    });

    return update.externalId;
  }),
  sendTestEmail: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const update = await db.query.companyUpdates.findFirst({ where: byId(ctx, input.id) });
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });
    await inngest.send({
      name: "company.update.published",
      data: {
        updateId: update.externalId,
        recipients: [ctx.user],
      },
    });
  }),
  delete: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const result = await db.delete(companyUpdates).where(byId(ctx, input.id)).returning();
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),
});

export const getFinancialReports = async (update: Update) => {
  const periodStartedOn = update.periodStartedOn != null ? parseISO(update.periodStartedOn) : null;
  if (periodStartedOn == null) return [];
  const month = periodStartedOn.getMonth() + 1;
  const year = periodStartedOn.getFullYear();
  return await db
    .select({
      ...pick(companyMonthlyFinancialReports, "month", "year"),
      ...(update.showRevenue ? pick(companyMonthlyFinancialReports, "revenueCents") : {}),
      ...(update.showNetIncome ? pick(companyMonthlyFinancialReports, "netIncomeCents") : {}),
    })
    .from(companyMonthlyFinancialReports)
    .where(
      and(
        eq(companyMonthlyFinancialReports.companyId, update.companyId),
        or(eq(companyMonthlyFinancialReports.year, year), eq(companyMonthlyFinancialReports.year, year - 1)),
        gte(companyMonthlyFinancialReports.month, month),
        lte(
          companyMonthlyFinancialReports.month,
          month + (update.period === "month" ? 0 : update.period === "quarter" ? 2 : 11),
        ),
      ),
    );
};
