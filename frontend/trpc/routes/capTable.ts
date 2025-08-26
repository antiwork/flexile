import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql, sum } from "drizzle-orm";
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

export const capTableRouter = createRouter({
  show: companyProcedure.input(z.object({ newSchema: z.boolean().optional() })).query(async ({ ctx, input }) => {
    const isAdminOrLawyer = !!(ctx.companyAdministrator || ctx.companyLawyer);
    if (!ctx.company.equityEnabled || !(isAdminOrLawyer || ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    let outstandingShares = BigInt(0);

    const investors: (CapTableInvestor | CapTableInvestorForAdmin)[] = [];
    const investorsConditions = (relation: typeof companyInvestorEntities | typeof companyInvestors) =>
      and(
        eq(relation.companyId, ctx.company.id),
        or(sql`${relation.totalShares} > 0`, sql`${relation.totalOptions} > 0`),
      );

    if (input.newSchema) {
      (
        await db
          .select({
            id: companyInvestorEntities.externalId,
            name: companyInvestorEntities.name,
            outstandingShares: companyInvestorEntities.totalShares,
            fullyDilutedShares: sql<bigint>`${companyInvestorEntities.totalShares} + ${companyInvestorEntities.totalOptions}`,
            email: companyInvestorEntities.email,
          })
          .from(companyInvestorEntities)
          .where(investorsConditions(companyInvestorEntities))
          .orderBy(desc(companyInvestorEntities.totalShares), desc(companyInvestorEntities.totalOptions))
      ).forEach((investor) => {
        outstandingShares += investor.outstandingShares;
        investors.push({
          ...(isAdminOrLawyer ? investor : omit(investor, "email")),
        });
      });
    } else {
      (
        await db
          .select({
            id: companyInvestors.externalId,
            userId: users.externalId,
            name: sql<string>`COALESCE(${users.legalName}, '')`,
            outstandingShares: companyInvestors.totalShares,
            fullyDilutedShares: companyInvestors.fullyDilutedShares,

            email: users.email,
          })
          .from(companyInvestors)
          .innerJoin(users, eq(companyInvestors.userId, users.id))
          .where(investorsConditions(companyInvestors))
          .orderBy(desc(companyInvestors.totalShares), desc(companyInvestors.totalOptions))
      ).forEach((investor) => {
        outstandingShares += investor.outstandingShares;
        investors.push(isAdminOrLawyer ? investor : omit(investor, "email"));
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
          .select({ total: sum(sql`${equityGrants.vestedShares} + ${equityGrants.unvestedShares}`).mapWith(Number) })
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
});
