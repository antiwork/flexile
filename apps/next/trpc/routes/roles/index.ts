import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { PayRateType, RoleApplicationStatus } from "@/db/enums";
import { companyRoleApplications, companyRoleRates, companyRoles, expenseCards } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { assertDefined } from "@/utils/assert";
import { roleApplicationsRouter } from "./applications";
import { publicRolesRouter } from "./public";

const inputSchema = createInsertSchema(companyRoles)
  .pick({
    name: true,
    jobDescription: true,
    activelyHiring: true,
    capitalizedExpense: true,
    expenseAccountId: true,
    expenseCardEnabled: true,
    expenseCardSpendingLimitCents: true,
    trialEnabled: true,
  })
  .merge(
    createInsertSchema(companyRoleRates, { payRateType: z.nativeEnum(PayRateType) })
      .pick({
        payRateType: true,
        trialPayRateInSubunits: true,
      })
      .extend({
        payRateInSubunits: z.number().nullable(),
        payPer: z.string().nullable(),
      }),
  );

export const rolesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const roles = await db.query.companyRoles.findMany({
      where: and(eq(companyRoles.companyId, ctx.company.id), isNull(companyRoles.deletedAt)),
      with: {
        rates: { orderBy: [desc(companyRoleRates.createdAt)], limit: 1 },
      },
      extras: {
        // using sql here to work around https://github.com/drizzle-team/drizzle-orm/issues/3564
        applicationCount: db
          .$count(
            companyRoleApplications,
            and(
              isNull(sql`deleted_at`),
              eq(sql`status`, RoleApplicationStatus.Pending),
              eq(sql`company_role_id`, companyRoles.id),
            ),
          )
          .as("applications"),
        expenseCardsCount: db
          .$count(expenseCards, and(eq(sql`active`, true), eq(sql`company_role_id`, companyRoles.id)))
          .as("expense_cards"),
      },
      orderBy: [desc(companyRoles.createdAt)],
    });

    return roles.map((role) => {
      const rate = assertDefined(role.rates[0]);
      return {
        id: role.externalId,
        ...pick(
          role,
          "name",
          "jobDescription",
          "activelyHiring",
          "capitalizedExpense",
          "expenseAccountId",
          "expenseCardEnabled",
          "expenseCardSpendingLimitCents",
          "trialEnabled",
          "applicationCount",
          "expenseCardsCount",
        ),
        ...pick(rate, "payRateType", "payRateInSubunits", "trialPayRateInSubunits", "payPer"),
      };
    });
  }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [role] = await db
      .select({
        ...pick(companyRoles, "id", "name", "jobDescription", "activelyHiring", "capitalizedExpense"),
        ...pick(companyRoleRates, "payRateType", "payRateInSubunits", "trialPayRateInSubunits", "payPer"),
      })
      .from(companyRoles)
      .innerJoin(companyRoleRates, eq(companyRoles.id, companyRoleRates.companyRoleId))
      .where(and(eq(companyRoles.companyId, ctx.company.id), eq(companyRoles.externalId, input.id)))
      .orderBy(desc(companyRoleRates.createdAt))
      .limit(1);

    if (!role) throw new TRPCError({ code: "NOT_FOUND" });

    return role;
  }),

  create: companyProcedure.input(inputSchema.required()).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return await db.transaction(async (tx) => {
      const result = await tx
        .insert(companyRoles)
        .values({
          companyId: ctx.company.id,
          ...pick(
            input,
            "name",
            "jobDescription",
            "activelyHiring",
            "capitalizedExpense",
            "expenseAccountId",
            "expenseCardEnabled",
            "expenseCardSpendingLimitCents",
            "trialEnabled",
          ),
        })
        .returning(pick(companyRoles, "id", "externalId"));

      const role = assertDefined(result[0]);
      await tx.insert(companyRoleRates).values({
        companyRoleId: role.id,
        ...pick(input, "payRateType", "trialPayRateInSubunits", "payPer"),
        payRateInSubunits:
          input.payRateType === PayRateType.ProjectBased ? (input.payRateInSubunits ?? null) : input.payRateInSubunits,
        payRateCurrency: "usd",
      });

      return role.externalId;
    });
  }),

  update: companyProcedure.input(inputSchema.partial().extend({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return await db.transaction(async (tx) => {
      const [role] = await tx
        .update(companyRoles)
        .set(
          pick(
            input,
            "name",
            "jobDescription",
            "activelyHiring",
            "capitalizedExpense",
            "expenseAccountId",
            "expenseCardEnabled",
            "expenseCardSpendingLimitCents",
            "trialEnabled",
          ),
        )
        .where(and(eq(companyRoles.externalId, input.id), eq(companyRoles.companyId, ctx.company.id)))
        .returning({ id: companyRoles.id, externalId: companyRoles.externalId });

      if (!role) throw new TRPCError({ code: "NOT_FOUND" });

      await tx
        .update(companyRoleRates)
        .set({
          companyRoleId: role.id,
          ...pick(input, "payRateType", "trialPayRateInSubunits", "payPer"),
          payRateInSubunits:
            input.payRateType === PayRateType.ProjectBased
              ? (input.payRateInSubunits ?? null)
              : input.payRateInSubunits,
          payRateCurrency: "usd",
        })
        .where(eq(companyRoleRates.companyRoleId, role.id));
    });
  }),

  delete: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
    const [result] = await db
      .update(companyRoles)
      .set({ deletedAt: new Date() })
      .where(and(eq(companyRoles.externalId, input.id), eq(companyRoles.companyId, ctx.company.id)))
      .returning();

    if (!result) throw new TRPCError({ code: "NOT_FOUND" });
  }),
  applications: roleApplicationsRouter,
  public: publicRolesRouter,
});
