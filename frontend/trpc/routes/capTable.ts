import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { omit, pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import {
  companyInvestorEntities,
  companyInvestors,
  convertibleInvestments,
  equityGrants,
  optionPools,
  shareClasses,
  shareHoldings,
  users,
} from "@/db/schema";
import type { CapTableInvestor, CapTableInvestorForAdmin } from "@/models/investor";
import { companyProcedure, createRouter } from "@/trpc";
import { company_administrator_cap_tables_url } from "@/utils/routes";

export const capTableRouter = createRouter({
  show: companyProcedure.input(z.object({ newSchema: z.boolean().optional() })).query(async ({ ctx, input }) => {
    const isAdminOrLawyer = !!(ctx.companyAdministrator || ctx.companyLawyer);
    if (!ctx.company.equityEnabled || !(isAdminOrLawyer || ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    let outstandingShares = BigInt(0);

    const investors: (CapTableInvestor | CapTableInvestorForAdmin)[] = [];
    const investorsConditions = (relation: typeof companyInvestorEntities | typeof companyInvestors) =>
      eq(relation.companyId, ctx.company.id);

    if (input.newSchema) {
      const potentialInvestors = await db
        .select({
          id: companyInvestorEntities.externalId,
          name: companyInvestorEntities.name,
          outstandingShares: companyInvestorEntities.totalShares,
          email: companyInvestorEntities.email,
          totalOptions: sql<bigint>`COALESCE((
            SELECT SUM(${equityGrants.vestedShares} + ${equityGrants.unvestedShares})
            FROM ${equityGrants}
            WHERE ${equityGrants.companyInvestorEntityId} = ${companyInvestorEntities.id}
          ), 0)`,
        })
        .from(companyInvestorEntities)
        .where(investorsConditions(companyInvestorEntities));

      potentialInvestors
        .filter((investor) => investor.outstandingShares > 0 || investor.totalOptions > 0)
        .sort((a, b) => Number(b.outstandingShares - a.outstandingShares) || Number(b.totalOptions - a.totalOptions))
        .forEach((investor) => {
          const fullyDilutedShares = BigInt(investor.outstandingShares) + BigInt(investor.totalOptions);
          outstandingShares += investor.outstandingShares;
          investors.push({
            ...(isAdminOrLawyer
              ? { ...investor, fullyDilutedShares }
              : omit({ ...investor, fullyDilutedShares }, "email")),
          });
        });
    } else {
      const potentialInvestors = await db
        .select({
          id: companyInvestors.externalId,
          userId: users.externalId,
          name: sql<string>`COALESCE(${users.legalName}, '')`,
          outstandingShares: companyInvestors.totalShares,
          email: users.email,
          totalOptions: sql<bigint>`COALESCE((
            SELECT SUM(${equityGrants.vestedShares} + ${equityGrants.unvestedShares})
            FROM ${equityGrants}
            WHERE ${equityGrants.companyInvestorId} = ${companyInvestors.id}
          ), 0)`,
        })
        .from(companyInvestors)
        .innerJoin(users, eq(companyInvestors.userId, users.id))
        .where(investorsConditions(companyInvestors));

      potentialInvestors
        .filter((investor) => investor.outstandingShares > 0 || investor.totalOptions > 0)
        .sort((a, b) => Number(b.outstandingShares - a.outstandingShares) || Number(b.totalOptions - a.totalOptions))
        .forEach((investor) => {
          const fullyDilutedShares = BigInt(investor.outstandingShares) + BigInt(investor.totalOptions);
          outstandingShares += investor.outstandingShares;
          investors.push(
            isAdminOrLawyer ? { ...investor, fullyDilutedShares } : omit({ ...investor, fullyDilutedShares }, "email"),
          );
        });
    }

    (
      await db
        .select({
          name: sql<string>`CONCAT(${convertibleInvestments.entityName}, ' ', ${convertibleInvestments.convertibleType})`,
        })
        .from(convertibleInvestments)
        .where(eq(convertibleInvestments.companyId, ctx.company.id))
        .orderBy(desc(convertibleInvestments.impliedShares))
    ).forEach((investment) => {
      investors.push(investment);
    });

    const pools = await db
      .select({
        id: optionPools.id,
        shareClassId: optionPools.shareClassId,
        name: optionPools.name,
        availableShares: optionPools.availableShares,
      })
      .from(optionPools)
      .where(eq(optionPools.companyId, ctx.company.id));

    const classes = await Promise.all(
      (
        await db
          .select({ id: shareClasses.id, name: shareClasses.name })
          .from(shareClasses)
          .where(eq(shareClasses.companyId, ctx.company.id))
      ).map(async (shareClass) => {
        const [holdings] = await db
          .select({ outstandingShares: sum(shareHoldings.numberOfShares).mapWith(Number) })
          .from(shareHoldings)
          .where(eq(shareHoldings.shareClassId, shareClass.id));
        const outstandingShares = holdings?.outstandingShares ?? 0;
        const poolIds = pools.filter((pool) => pool.shareClassId === shareClass.id).map((pool) => pool.id);
        const [grants] = await db
          .select({
            exercisableShares: sum(sql`${equityGrants.vestedShares} + ${equityGrants.unvestedShares}`).mapWith(Number),
          })
          .from(equityGrants)
          .where(inArray(equityGrants.optionPoolId, poolIds));
        const exercisableShares = grants?.exercisableShares ?? 0;
        return {
          id: shareClass.id,
          name: shareClass.name,
          outstandingShares,
          fullyDilutedShares: outstandingShares + exercisableShares,
        };
      }),
    );

    const exercisePricesResult = await db
      .selectDistinct({ exercisePriceUsd: equityGrants.exercisePriceUsd })
      .from(equityGrants)
      .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
      .where(eq(optionPools.companyId, ctx.company.id))
      .orderBy(equityGrants.exercisePriceUsd);

    const exercisePrices = exercisePricesResult.map((r) => r.exercisePriceUsd);

    // Add breakdown data to each investor
    for (const investor of investors) {
      if (!("id" in investor)) {
        // Skip SAFE investments - they don't have breakdowns
        investor.sharesByClass = {};
        investor.optionsByStrike = {};
        continue;
      }

      const sharesByClass: Record<string, number> = {};
      const optionsByStrike: Record<string, number> = {};

      // Get share holdings by share class
      for (const shareClass of classes) {
        const joinCondition = input.newSchema
          ? eq(companyInvestorEntities.externalId, investor.id)
          : eq(companyInvestors.externalId, investor.id);

        const [holdings] = await db
          .select({ total: sum(shareHoldings.numberOfShares).mapWith(Number) })
          .from(shareHoldings)
          .innerJoin(
            input.newSchema ? companyInvestorEntities : companyInvestors,
            input.newSchema
              ? eq(shareHoldings.companyInvestorEntityId, companyInvestorEntities.id)
              : eq(shareHoldings.companyInvestorId, companyInvestors.id),
          )
          .where(and(joinCondition, eq(shareHoldings.shareClassId, shareClass.id)));
        sharesByClass[shareClass.name] = holdings?.total ?? 0;
      }

      // Get option grants by exercise price
      for (const exercisePrice of exercisePrices) {
        const [grants] = await db
          .select({ total: sum(equityGrants.vestedShares).mapWith(Number) })
          .from(equityGrants)
          .innerJoin(optionPools, eq(equityGrants.optionPoolId, optionPools.id))
          .innerJoin(
            input.newSchema ? companyInvestorEntities : companyInvestors,
            input.newSchema
              ? eq(equityGrants.companyInvestorEntityId, companyInvestorEntities.id)
              : eq(equityGrants.companyInvestorId, companyInvestors.id),
          )
          .where(
            and(
              input.newSchema
                ? eq(companyInvestorEntities.externalId, investor.id)
                : eq(companyInvestors.externalId, investor.id),
              eq(equityGrants.exercisePriceUsd, exercisePrice),
              eq(optionPools.companyId, ctx.company.id),
            ),
          );
        const strikeKey = `$${Number(exercisePrice).toFixed(2)}`;
        optionsByStrike[strikeKey] = grants?.total ?? 0;
      }

      investor.sharesByClass = sharesByClass;
      investor.optionsByStrike = optionsByStrike;
    }

    return {
      investors,
      fullyDilutedShares: ctx.company.fullyDilutedShares,
      outstandingShares,

      optionPools: pools.map((pool) => pick(pool, ["name", "availableShares"])),
      shareClasses: classes,
      allShareClasses: classes.map((sc) => sc.name),
      exercisePrices: exercisePrices.map((price) => `$${Number(price).toFixed(2)}`),
    };
  }),

  create: companyProcedure
    .input(
      z.object({
        investors: z.array(
          z.object({
            userId: z.string(),
            shares: z.number().positive(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN", message: "Equity must be enabled" });

      const response = await fetch(company_administrator_cap_tables_url(ctx.company.externalId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...ctx.headers,
        },
        body: JSON.stringify({
          cap_table: {
            investors: input.investors,
          },
        }),
      });

      if (!response.ok) {
        const errorSchema = z.object({
          errors: z.array(z.string()).optional(),
        });
        const errorData = errorSchema.parse(await response.json().catch(() => ({})));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errorData.errors?.join(", ") || "Failed to create cap table",
        });
      }

      return { success: true };
    }),
});
