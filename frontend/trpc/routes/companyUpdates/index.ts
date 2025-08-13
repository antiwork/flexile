import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick, truncate } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import {
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyUpdates,
  invoices,
  users,
} from "@/db/schema";
import { inngest } from "@/inngest/client";
import { type CompanyContext, companyProcedure, createRouter, renderTiptapToText } from "@/trpc";
import { isActive } from "@/trpc/routes/contractors";
import { minBilledAmountSchema, type RecipientType, recipientTypesSchema } from "@/types/recipientTypes";
import { assertDefined } from "@/utils/assert";

const byId = (ctx: CompanyContext, id: string) =>
  and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id));

const dataSchema = createInsertSchema(companyUpdates)
  .pick({
    title: true,
    body: true,
  })
  .extend({
    recipientTypes: z.array(z.enum(["admins", "investors", "active_contractors", "alumni_contractors"])).optional(),
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
      ...pick(update, ["title", "sentAt", "recipientTypes"]),
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
      ...pick(update, ["title", "body", "sentAt", "recipientTypes"]),
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
        recipientTypes: Array.from(new Set([...(input.recipientTypes ?? []), "admins"])),
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
        recipientTypes: Array.from(new Set([...(input.recipientTypes ?? []), "admins"])),
      })
      .where(byId(ctx, input.id))
      .returning();
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });
  }),
  publish: companyProcedure
    .input(
      z.object({
        id: z.string(),
        minBilledAmount: minBilledAmountSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasInvestors = await checkHasInvestors(ctx.company.id);
      if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const [update] = await db
        .update(companyUpdates)
        .set({ sentAt: new Date() })
        .where(and(byId(ctx, input.id), isNull(companyUpdates.sentAt)))
        .returning();

      if (!update) throw new TRPCError({ code: "NOT_FOUND" });

      // Validate recipient types from database
      const validRecipientTypes = update.recipientTypes?.filter(
        (type): type is RecipientType =>
          type === "admins" || type === "investors" || type === "active_contractors" || type === "alumni_contractors",
      );

      await inngest.send({
        name: "company.update.published",
        data: {
          updateId: update.externalId,
          recipientTypes: validRecipientTypes?.length ? validRecipientTypes : undefined,
          minBilledAmount: input.minBilledAmount,
        },
      });

      return update.externalId;
    }),
  sendTestEmail: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const update = await db.query.companyUpdates.findFirst({ where: byId(ctx, input.id) });
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });
  }),
  delete: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hasInvestors = await checkHasInvestors(ctx.company.id);
    if (!hasInvestors || !ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const result = await db.delete(companyUpdates).where(byId(ctx, input.id)).returning();
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),
  getUniqueRecipientCount: companyProcedure
    .input(
      z.object({
        recipientTypes: recipientTypesSchema,
        minBilledAmount: minBilledAmountSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const companyId = ctx.company.id;
      const queries: Promise<{ email: string }[]>[] = [];

      // Build base query function
      const baseQuery = (
        relationTable: typeof companyContractors | typeof companyInvestors | typeof companyAdministrators,
      ) =>
        db
          .selectDistinct({ email: users.email })
          .from(users)
          .leftJoin(relationTable, and(eq(users.id, relationTable.userId), eq(relationTable.companyId, companyId)));

      // Always include admins if in the list
      if (input.recipientTypes.includes("admins")) {
        const admins = baseQuery(companyAdministrators).where(isNotNull(companyAdministrators.id));
        queries.push(admins);
      }

      if (input.recipientTypes.includes("investors")) {
        const investors = baseQuery(companyInvestors).where(isNotNull(companyInvestors.id));
        queries.push(investors);
      }

      if (input.recipientTypes.includes("active_contractors")) {
        // Apply min billed filter if specified
        if (input.minBilledAmount && input.minBilledAmount > 0) {
          const activeContractors = db
            .selectDistinct({ email: users.email })
            .from(users)
            .leftJoin(
              companyContractors,
              and(eq(users.id, companyContractors.userId), eq(companyContractors.companyId, companyId)),
            )
            .leftJoin(invoices, eq(invoices.companyContractorId, companyContractors.id))
            .where(and(isNotNull(companyContractors.id), isNull(companyContractors.endedAt)))
            .groupBy(users.email)
            .having(
              gte(
                sql`COALESCE(SUM(${invoices.totalAmountInUsdCents}), 0)`,
                BigInt(Math.round(input.minBilledAmount * 100)),
              ),
            );
          queries.push(activeContractors);
        } else {
          const activeContractors = baseQuery(companyContractors).where(
            and(isNotNull(companyContractors.id), isNull(companyContractors.endedAt)),
          );
          queries.push(activeContractors);
        }
      }

      if (input.recipientTypes.includes("alumni_contractors")) {
        // Apply min billed filter if specified
        if (input.minBilledAmount && input.minBilledAmount > 0) {
          const alumniContractors = db
            .selectDistinct({ email: users.email })
            .from(users)
            .leftJoin(
              companyContractors,
              and(eq(users.id, companyContractors.userId), eq(companyContractors.companyId, companyId)),
            )
            .leftJoin(invoices, eq(invoices.companyContractorId, companyContractors.id))
            .where(and(isNotNull(companyContractors.id), isNotNull(companyContractors.endedAt)))
            .groupBy(users.email)
            .having(
              gte(
                sql`COALESCE(SUM(${invoices.totalAmountInUsdCents}), 0)`,
                BigInt(Math.round(input.minBilledAmount * 100)),
              ),
            );
          queries.push(alumniContractors);
        } else {
          const alumniContractors = baseQuery(companyContractors).where(
            and(isNotNull(companyContractors.id), isNotNull(companyContractors.endedAt)),
          );
          queries.push(alumniContractors);
        }
      }

      if (queries.length === 0) {
        return { uniqueCount: 0 };
      }

      // Execute all queries in parallel and deduplicate
      const allRecipients = (await Promise.all(queries)).flat();

      // Deduplicate by email
      const uniqueEmails = new Set(allRecipients.map((r) => r.email));
      return { uniqueCount: uniqueEmails.size };
    }),
});
