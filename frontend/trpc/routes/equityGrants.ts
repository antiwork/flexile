import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, gte, isNotNull, isNull, lte, or, sql, type SQLWrapper, sum } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { omit, pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { DocumentTemplateType, optionGrantTypes, optionGrantVestingTriggers } from "@/db/enums";
import {
  companyContractors,
  companyInvestors,
  documents,
  documentTemplates,
  equityGrantExercises,
  equityGrants,
  equityGrantTransactions,
  optionPools,
  users,
  vestingEvents,
  vestingSchedules,
} from "@/db/schema";
import { DEFAULT_VESTING_SCHEDULE_OPTIONS } from "@/models";
import { type CompanyContext, companyProcedure, createRouter } from "@/trpc";
import { createSubmission } from "@/trpc/routes/documents/templates";
import { simpleUser } from "@/trpc/routes/users";
import { assertDefined } from "@/utils/assert";
import { company_administrator_equity_grants_url } from "@/utils/routes";

export type EquityGrant = typeof equityGrants.$inferSelect;
export const equityGrantsRouter = createRouter({
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const canViewAll = ctx.companyAdministrator || ctx.companyLawyer;
    if (!canViewAll && !ctx.companyInvestor) throw new TRPCError({ code: "FORBIDDEN" });

    const equityGrant = await db.query.equityGrants.findFirst({
      where: and(
        eq(equityGrants.externalId, input.id),
        canViewAll || !ctx.companyInvestor ? undefined : eq(equityGrants.companyInvestorId, ctx.companyInvestor.id),
      ),
      columns: {
        optionHolderName: true,
        issueDateRelationship: true,
        optionGrantType: true,
        numberOfShares: true,
        exercisedShares: true,
        forfeitedShares: true,
        vestedShares: true,
        unvestedShares: true,
        issuedAt: true,
        periodEndedAt: true,
        expiresAt: true,
        boardApprovalDate: true,
        voluntaryTerminationExerciseMonths: true,
        involuntaryTerminationExerciseMonths: true,
        terminationWithCauseExerciseMonths: true,
        deathExerciseMonths: true,
        disabilityExerciseMonths: true,
        retirementExerciseMonths: true,
        exercisePriceUsd: true,
        vestedAmountUsd: true,
        acceptedAt: true,
      },
      with: {
        optionPool: { columns: { name: true, companyId: true } },
        companyInvestor: { with: { user: { columns: { countryCode: true, state: true, email: true } } } },
        vestingEvents: {
          orderBy: (vestingEvents, { asc }) => [asc(vestingEvents.vestingDate)],
        },
      },
    });

    if (equityGrant?.optionPool.companyId !== ctx.company.id) throw new TRPCError({ code: "NOT_FOUND" });

    return equityGrant;
  }),
  list: companyProcedure
    .input(
      z.object({
        investorId: z.string().nullish(),
        accepted: z.boolean().optional(),
        eventuallyExercisable: z.boolean().optional(),
        orderBy: z.enum(["issuedAt", "periodEndedAt"]).default("issuedAt"),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (
        !ctx.companyAdministrator &&
        !ctx.companyLawyer &&
        (!ctx.companyInvestor || ctx.companyInvestor.externalId !== input.investorId)
      )
        throw new TRPCError({ code: "FORBIDDEN" });

      const where = and(
        eq(optionPools.companyId, ctx.company.id),
        input.investorId ? eq(companyInvestors.externalId, input.investorId) : undefined,
        input.accepted ? isNotNull(equityGrants.acceptedAt) : undefined,
        input.eventuallyExercisable
          ? or(
              gt(equityGrants.vestedShares, 0),
              gt(equityGrants.unvestedShares, 0),
              eq(equityGrants.exercisedShares, 0),
            )
          : undefined,
      );
      return await db
        .select({
          ...pick(
            equityGrants,
            "issuedAt",
            "numberOfShares",
            "vestedShares",
            "unvestedShares",
            "exercisedShares",
            "vestedAmountUsd",
            "exercisePriceUsd",
            "optionGrantType",
            "periodEndedAt",
            "periodStartedAt",
            "forfeitedShares",
            "acceptedAt",
            "expiresAt",
            "boardApprovalDate",
            "voluntaryTerminationExerciseMonths",
            "involuntaryTerminationExerciseMonths",
            "terminationWithCauseExerciseMonths",
            "deathExerciseMonths",
            "disabilityExerciseMonths",
            "retirementExerciseMonths",
            "issueDateRelationship",
            "optionHolderName",
          ),
          id: equityGrants.externalId,
          user: { id: users.externalId },
          activeExercise: pick(equityGrantExercises, "id", "numberOfOptions", "totalCostCents"),
          optionPool: pick(optionPools, "name"),
        })
        .from(equityGrants)
        .innerJoin(companyInvestors, eq(equityGrants.companyInvestorId, companyInvestors.id))
        .innerJoin(users, eq(companyInvestors.userId, users.id))
        .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
        .leftJoin(equityGrantExercises, eq(equityGrants.activeExerciseId, equityGrantExercises.id))
        .where(where)
        .orderBy(desc(equityGrants[input.orderBy]));
    }),
  create: companyProcedure
    .input(
      createInsertSchema(equityGrants)
        .pick({ issueDateRelationship: true })
        .extend({
          companyWorkerId: z.string(),
          optionPoolId: z.string(),
          numberOfShares: z.number(),
          optionGrantType: z.enum(optionGrantTypes),
          optionExpiryMonths: z.number(),
          voluntaryTerminationExerciseMonths: z.number(),
          involuntaryTerminationExerciseMonths: z.number(),
          terminationWithCauseExerciseMonths: z.number(),
          deathExerciseMonths: z.number(),
          disabilityExerciseMonths: z.number(),
          retirementExerciseMonths: z.number(),
          boardApprovalDate: z.string(),
          vestingTrigger: z.enum(optionGrantVestingTriggers),
          vestingScheduleId: z.string().nullable(),
          vestingCommencementDate: z.string().nullable(),
          totalVestingDurationMonths: z.number().nullable(),
          cliffDurationMonths: z.number().nullable(),
          vestingFrequencyMonths: z.string().nullable(),
          docusealTemplateId: z.string(),
        }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.externalId, input.docusealTemplateId),
          eq(documentTemplates.type, DocumentTemplateType.EquityPlanContract),
          or(eq(documentTemplates.companyId, ctx.company.id), isNull(documentTemplates.companyId)),
        ),
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      const worker = await db.query.companyContractors.findFirst({
        where: and(
          eq(companyContractors.externalId, input.companyWorkerId),
          eq(companyContractors.companyId, ctx.company.id),
        ),
        with: { user: true },
      });
      if (!worker) throw new TRPCError({ code: "NOT_FOUND" });
      const response = await fetch(
        company_administrator_equity_grants_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ctx.headers },
          body: JSON.stringify({
            equity_grant: {
              company_worker_id: input.companyWorkerId,
              option_pool_id: input.optionPoolId,
              number_of_shares: input.numberOfShares,
              issue_date_relationship: input.issueDateRelationship,
              option_grant_type: input.optionGrantType,
              option_expiry_months: input.optionExpiryMonths,
              voluntary_termination_exercise_months: input.voluntaryTerminationExerciseMonths,
              involuntary_termination_exercise_months: input.involuntaryTerminationExerciseMonths,
              termination_with_cause_exercise_months: input.terminationWithCauseExerciseMonths,
              death_exercise_months: input.deathExerciseMonths,
              disability_exercise_months: input.disabilityExerciseMonths,
              retirement_exercise_months: input.retirementExerciseMonths,
              board_approval_date: input.boardApprovalDate,
              vesting_trigger: input.vestingTrigger,
              vesting_schedule_id: input.vestingScheduleId,
              vesting_commencement_date: input.vestingCommencementDate,
              total_vesting_duration_months: input.totalVestingDurationMonths,
              cliff_duration_months: input.cliffDurationMonths,
              vesting_frequency_months: input.vestingFrequencyMonths,
            },
          }),
        },
      );

      if (!response.ok) throw new TRPCError({ code: "BAD_REQUEST", message: await response.text() });
      const { document_id } = z.object({ document_id: z.number() }).parse(await response.json());
      const submission = await createSubmission(ctx, template.docusealId, worker.user, "Company Representative");
      await db
        .update(documents)
        .set({ docusealSubmissionId: submission.id })
        .where(eq(documents.id, BigInt(document_id)));
      return { documentId: document_id };
    }),
  totals: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });
    const [totals] = await db
      .select({
        unvestedShares: sum(equityGrants.unvestedShares).mapWith(Number),
        vestedShares: sum(equityGrants.vestedShares).mapWith(Number),
        exercisedShares: sum(equityGrants.exercisedShares).mapWith(Number),
      })
      .from(equityGrants)
      .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
      .where(eq(optionPools.companyId, ctx.company.id));
    return assertDefined(totals);
  }),
  getUniqueUnvested: companyProcedure.input(z.object({ year: z.number() })).query(async ({ input, ctx }) => ({
    grant: await getUniqueUnvestedEquityGrantForYear(ctx.companyContractor, input.year),
  })),

  sumVestedShares: companyProcedure
    .input(z.object({ investorId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      if (
        !ctx.companyAdministrator &&
        (!ctx.companyInvestor || (input.investorId && input.investorId !== ctx.companyInvestor.externalId))
      )
        throw new TRPCError({ code: "FORBIDDEN" });

      return sumVestedShares(
        ctx.company.id,
        input.investorId ? byExternalId(companyInvestors, input.investorId) : undefined,
      );
    }),
  new: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const pools = await db.query.optionPools.findMany({
      columns: {
        externalId: true,
        name: true,
        availableShares: true,
        defaultOptionExpiryMonths: true,
        voluntaryTerminationExerciseMonths: true,
        involuntaryTerminationExerciseMonths: true,
        terminationWithCauseExerciseMonths: true,
        deathExerciseMonths: true,
        disabilityExerciseMonths: true,
        retirementExerciseMonths: true,
      },
      where: eq(optionPools.companyId, ctx.company.id),
    });
    const workers = await db.query.companyContractors.findMany({
      columns: {
        externalId: true,
      },
      with: {
        user: {
          columns: simpleUser.columns,
          with: {
            companyInvestors: {
              where: eq(companyInvestors.companyId, ctx.company.id),
              with: {
                equityGrants: {
                  orderBy: desc(equityGrants.issuedAt),
                  limit: 1,
                },
              },
            },
          },
        },
      },
      where: and(
        eq(companyContractors.companyId, ctx.company.id),
        isNull(companyContractors.endedAt),
        lte(companyContractors.startedAt, new Date()),
      ),
    });

    const defaultVestingSchedules = (
      await Promise.all(
        DEFAULT_VESTING_SCHEDULE_OPTIONS.map(async (option) => {
          const schedule =
            (await db.query.vestingSchedules.findFirst({
              where: and(
                eq(vestingSchedules.totalVestingDurationMonths, option.totalVestingDurationMonths),
                eq(vestingSchedules.cliffDurationMonths, option.cliffDurationMonths),
                eq(vestingSchedules.vestingFrequencyMonths, option.vestingFrequencyMonths),
              ),
            })) ||
            (
              await db
                .insert(vestingSchedules)
                .values({
                  totalVestingDurationMonths: option.totalVestingDurationMonths,
                  cliffDurationMonths: option.cliffDurationMonths,
                  vestingFrequencyMonths: option.vestingFrequencyMonths,
                })
                .returning()
            )[0];
          return schedule ? { id: schedule.externalId, name: option.name } : null;
        }),
      )
    ).filter((schedule) => schedule !== null);

    return {
      optionPools: pools.map((pool) => omit({ ...pool, id: pool.externalId }, "externalId")),
      workers: workers.map((worker) => {
        const lastGrant = worker.user.companyInvestors[0]?.equityGrants[0];
        return {
          id: worker.externalId,
          user: { ...simpleUser(worker.user), legalName: worker.user.legalName },
          salaried: false,
          lastGrant: lastGrant
            ? {
                optionGrantType: lastGrant.optionGrantType,
                issueDateRelationship: lastGrant.issueDateRelationship,
              }
            : null,
        };
      }),
      defaultVestingSchedules,
    };
  }),
  cancel: companyProcedure.input(z.object({ id: z.string(), reason: z.string() })).mutation(async ({ input, ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    await db.transaction(async (tx) => {
      const equityGrant = await db.query.equityGrants.findFirst({
        where: eq(equityGrants.externalId, input.id),
        with: {
          vestingEvents: {
            where: and(
              isNull(vestingEvents.processedAt),
              isNull(vestingEvents.cancelledAt),
              gt(sql`DATE(${vestingEvents.vestingDate})`, new Date()),
            ),
          },
          optionPool: true,
        },
      });

      if (equityGrant?.optionPool.companyId !== ctx.company.id) throw new TRPCError({ code: "NOT_FOUND" });

      const totalForfeitedShares = equityGrant.unvestedShares + equityGrant.forfeitedShares;

      await tx.insert(equityGrantTransactions).values([
        {
          transactionType: "cancellation",
          equityGrantId: equityGrant.id,
          forfeitedShares: BigInt(equityGrant.unvestedShares),
          totalNumberOfShares: BigInt(equityGrant.numberOfShares),
          totalVestedShares: BigInt(equityGrant.vestedShares),
          totalUnvestedShares: BigInt(0),
          totalExercisedShares: BigInt(equityGrant.exercisedShares),
          totalForfeitedShares: BigInt(totalForfeitedShares),
        },
      ]);

      const cancelledAt = new Date();
      for (const vestingEvent of equityGrant.vestingEvents) {
        await tx
          .update(vestingEvents)
          .set({ cancelledAt, cancellationReason: input.reason })
          .where(eq(vestingEvents.id, vestingEvent.id));
      }

      await tx
        .update(equityGrants)
        .set({
          forfeitedShares: totalForfeitedShares,
          unvestedShares: 0,
          cancelledAt,
        })
        .where(eq(equityGrants.id, equityGrant.id));

      await tx
        .update(optionPools)
        .set({ issuedShares: equityGrant.optionPool.issuedShares - BigInt(equityGrant.unvestedShares) })
        .where(eq(optionPools.id, equityGrant.optionPoolId));
    });

    return { success: true };
  }),
});

export const sumVestedShares = async (companyId: bigint, investorId: bigint | SQLWrapper | undefined) => {
  const [result] = await db
    .select({ total: sum(equityGrants.vestedShares).mapWith(Number) })
    .from(equityGrants)
    .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
    .where(
      and(
        investorId ? eq(equityGrants.companyInvestorId, investorId) : undefined,
        eq(optionPools.companyId, companyId),
        gt(equityGrants.vestedShares, 0),
      ),
    );
  return assertDefined(result).total;
};

export const getUniqueUnvestedEquityGrantForYear = async (
  companyContractor: CompanyContext["companyContractor"],
  year: number,
) => {
  if (!companyContractor) return null;
  const investor = await db.query.companyInvestors.findFirst({
    where: and(
      eq(companyInvestors.companyId, companyContractor.companyId),
      eq(companyInvestors.userId, companyContractor.userId),
    ),
    columns: { id: true, companyId: true },
  });
  if (!investor) return null;

  const grants = await db.query.equityGrants.findMany({
    where: and(
      eq(equityGrants.companyInvestorId, investor.id),
      eq(equityGrants.vestingTrigger, "invoice_paid"),
      sql`EXTRACT(YEAR FROM ${equityGrants.periodEndedAt}) = ${year}`,
      gte(equityGrants.unvestedShares, 1),
    ),
  });

  return grants.length === 1 ? grants[0] : null;
};
