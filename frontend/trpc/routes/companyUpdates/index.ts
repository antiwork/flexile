import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick, truncate } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { companyInvestors, companyUpdates } from "@/db/schema";
import { type CompanyContext, companyProcedure, createRouter, renderTiptapToText } from "@/trpc";
import { isActive } from "@/trpc/routes/contractors";
import { assertDefined } from "@/utils/assert";
import { send_emails_company_company_update_path, send_test_email_company_company_update_path } from "@/utils/routes";

const byId = (ctx: CompanyContext, id: string) =>
  and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id));

const dataSchema = createInsertSchema(companyUpdates).pick({
  title: true,
  body: true,
});

const checkHasInvestors = async (companyId: bigint) => {
  const hasInvestors = await db.query.companyInvestors.findFirst({
    where: eq(companyInvestors.companyId, companyId),
  });
  return !!hasInvestors;
};

export const companyUpdatesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor))
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
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });
    const update = await db.query.companyUpdates.findFirst({ where: byId(ctx, input.id) });
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      ...pick(update, ["title", "body", "sentAt"]),

      id: update.externalId,
    };
  }),
  create: companyProcedure.input(dataSchema.required()).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [update] = await db
      .insert(companyUpdates)
      .values({
        ...pick(input, ["title", "body"]),
        companyId: ctx.company.id,
      })
      .returning();
    return assertDefined(update).externalId;
  }),
  update: companyProcedure.input(dataSchema.extend({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const [update] = await db
      .update(companyUpdates)
      .set({
        ...pick(input, ["title", "body"]),
        companyId: ctx.company.id,
      })
      .where(byId(ctx, input.id))
      .returning();
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });
  }),
  publish: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [update] = await db
      .update(companyUpdates)
      .set({ sentAt: new Date() })
      .where(and(byId(ctx, input.id), isNull(companyUpdates.sentAt)))
      .returning();

    if (!update) throw new TRPCError({ code: "NOT_FOUND" });

    try {
      await fetch(send_emails_company_company_update_path(ctx.company.id, update.externalId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
    } catch (_error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send emails for company update" });
    }

    return update.externalId;
  }),
  sendTestEmail: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const update = await db.query.companyUpdates.findFirst({ where: byId(ctx, input.id) });
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });

    try {
      await fetch(send_test_email_company_company_update_path(ctx.company.id, update.externalId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recipient_user_id: ctx.user.id,
        }),
      });
    } catch (_error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send test email" });
    }
  }),
  delete: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const result = await db.delete(companyUpdates).where(byId(ctx, input.id)).returning();
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),
});
